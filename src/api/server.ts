import * as express from 'express';
import * as socketio from 'socket.io';
import * as http from 'http';
import * as path from 'path';

import * as expressRateLimit from 'express-rate-limit';
import * as expressRedisStore from 'rate-limit-redis';

import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as cookieParser from 'cookie-parser';

import ConnectionManager from '../connections/manager';
import { IServerConfig } from '../types/config';
import logger from '../utils/winston';
import { expressRedisCache, ExpressRedisCacheHandler } from '../utils/cache';

const packageJson: any = require('../../package.json');

export class HTTPServer {
    readonly httpServer: http.Server;

    readonly web: WebServer;
    readonly socket: SocketServer;

    constructor(readonly config: IServerConfig, readonly connection: ConnectionManager) {
        this.web = new WebServer(this);

        this.httpServer = http.createServer(this.web.express);

        this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
            logger.error(error);
        });

        this.httpServer.on('listening', () => {
            const addr = this.httpServer.address();
            const bind = typeof addr === 'string'
                ? 'pipe ' + addr
                : 'port ' + addr.port;

            logger.info('Listening on ' + bind);
        });

        this.socket = new SocketServer(this);
    }

    listen(): void {
        this.httpServer.listen(this.config.server_port, this.config.server_addr);
    }
}

export class WebServer {
    readonly express: express.Application;

    readonly limiter: expressRateLimit.RateLimit;
    readonly caching: ExpressRedisCacheHandler;

    constructor(readonly server: HTTPServer) {
        this.express = express();

        if (this.server.config.trust_proxy) {
            this.express.set('trust proxy', 1);
        }

        this.express.disable('x-powered-by');

        this.limiter = expressRateLimit({
            windowMs: this.server.config.rate_limit.interval * 1000,
            max: this.server.config.rate_limit.requests,
            handler: (req: express.Request, res: express.Response, next: express.NextFunction): any => {
                if (this.server.config.ip_whitelist.indexOf(req.ip) >= 0) {
                    return next();
                }

                res.json({success: false, message: 'Rate limit'});
            },
            keyGenerator(req: express.Request): string {
                logger.debug('Rate limit increase for ' + req.ip);

                return req.ip;
            },
            store: new expressRedisStore({
                client: this.server.connection.redis.nodeRedis,
                prefix: 'eosio-contract-api:' + server.connection.chain.name + ':rate-limit:',
                expiry: this.server.config.rate_limit.interval
            })
        });

        this.caching = expressRedisCache(
            this.server.connection.redis.nodeRedis,
            'eosio-contract-api:' + this.server.connection.chain.name + ':express-cache:',
            this.server.config.cache_life || 0,
            this.server.config.ip_whitelist || []
        );

        this.middleware();
        this.routes();
    }

    private middleware(): void {
        this.express.use(bodyParser.json());
        this.express.use(bodyParser.urlencoded({ extended: false }));
        this.express.use(cookieParser());
        this.express.use(cors());

        this.express.use((req, _, next) => {
            logger.debug(req.method + ' ' + req.url, req.body);

            next();
        });
    }

    private routes(): void {
        const router = express.Router();

        router.get('/health', this.caching() , async (_: express.Request, res: express.Response) => {
            let databaseStatus = 'INVALID';

            try {
                const query = await this.server.connection.database.query('SELECT * FROM contract_readers');

                if (query.rowCount > 0) {
                    databaseStatus = 'OK';
                }
            } catch (e) {
                databaseStatus = 'ERROR';
            }

            let chainStatus;

            try {
                const info = await this.server.connection.chain.rpc.get_info();

                if (Date.now() - 20 * 1000 < new Date(info.head_block_time + '+0000').getTime()) {
                    chainStatus = 'OK';
                } else {
                    chainStatus = 'NODE_BEHIND';
                }
            } catch (e) {
                chainStatus = 'ERROR';
            }

            res.json({
                success: true, data: {
                    version: packageJson.version,
                    postgres: {
                        status: databaseStatus
                    },
                    redis: {
                        status: this.server.connection.redis.ioRedis.status === 'ready' ? 'OK' : 'ERROR'
                    },
                    chain: {
                        status: chainStatus
                    }
                }
            });
        });

        router.use('/docs/assets', express.static(path.resolve(__dirname, '../../docs/assets')));

        this.express.use(router);
    }
}

export class SocketServer {
    readonly io: socketio.Server;

    constructor(readonly server: HTTPServer) {
        this.io = socketio(this.server.httpServer, {
            origins: '*:*'
        });

        this.init().then();
    }

    async init(): Promise<void> {
        const pattern = ['eosio-contract-api', this.server.connection.chain.name, 'socket-connections', '*'].join(':');
        const keys = await this.server.connection.redis.ioRedis.keys(pattern);

        const pipeline = this.server.connection.redis.ioRedis.pipeline();

        for (const key of keys) {
            pipeline.del(key);
        }

        await pipeline.exec();
    }

    async reserveConnection(socket: socketio.Socket): Promise<boolean> {
        let ip;
        if (this.server.config.trust_proxy && socket.handshake.headers['x-forwarded-for']) {
            ip = socket.handshake.headers['x-forwarded-for'].split(',')[0];
        } else {
            ip = socket.conn.remoteAddress;
        }

        logger.debug('reserve socket connection for ' + ip);

        const key = ['eosio-contract-api', this.server.connection.chain.name, 'socket-connections', ip].join(':');
        const connections = parseInt(await this.server.connection.redis.ioRedis.get(key), 10);

        if (isNaN(connections) || connections < this.server.config.socket_limit.connections_per_ip) {
            await this.server.connection.redis.ioRedis.incr(key);

            return true;
        }

        return false;
    }

    async releaseConnection(socket: socketio.Socket): Promise<void> {
        let ip;
        if (this.server.config.trust_proxy) {
            ip = socket.handshake.headers['x-forwarded-for'].split(',')[0];
        } else {
            ip = socket.conn.remoteAddress;
        }

        const key = ['eosio-contract-api', this.server.connection.chain.name, 'socket-connections', ip].join(':');

        await this.server.connection.redis.ioRedis.decr(key);
    }
}