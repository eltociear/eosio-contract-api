import * as express from 'express';

import { AtomicMarketNamespace } from '../index';
import { HTTPServer } from '../../../server';
import { atomicassetsComponents, greylistFilterParameters } from '../../atomicassets/openapi';
import { dateBoundaryParameters, getOpenAPI3Responses, paginationParameters, primaryBoundaryParameters } from '../../../docs';
import {
    getStatsAccountAction,
    getStatsAccountsAction,
    getStatsCollectionAction,
    getStatsCollectionsAction,
    getStatsCollectionV1Action,
    getStatsCollectionV2Action,
    getStatsGraphAction,
    getStatsMarketsAction, getStatsSalesAction
} from '../handlers/stats';

export function statsEndpoints(core: AtomicMarketNamespace, server: HTTPServer, router: express.Router): any {
    const {caching, returnAsJSON} = server.web;

    router.all('/v1/stats/collections', caching(), returnAsJSON(getStatsCollectionsAction, core));

    router.all('/v1/stats/collections/:collection_name', caching(), returnAsJSON(getStatsCollectionAction, core));

    router.all('/v1/stats/accounts', caching(), returnAsJSON(getStatsAccountsAction, core));

    router.all('/v1/stats/accounts/:account', caching(), returnAsJSON(getStatsAccountAction, core));

    router.all('/v1/stats/schemas/:collection_name', caching(), returnAsJSON(getStatsCollectionV1Action, core));

    router.all('/v2/stats/schemas/:collection_name', caching(), returnAsJSON(getStatsCollectionV2Action, core));

    router.all('/v1/stats/markets', caching(), returnAsJSON(getStatsMarketsAction, core));

    router.all('/v1/stats/graph', server.web.caching({factor: 60}), returnAsJSON(getStatsGraphAction, core));

    router.all('/v1/stats/sales', caching(), returnAsJSON(getStatsSalesAction, core));

    const SymbolResult = {
        type: 'object',
        properties: {
            token_contract: {type: 'string'},
            token_symbol: {type: 'string'},
            token_precision: {type: 'integer'}
        }
    };

    const CollectionResult = {
        type: 'object',
        properties: {
            ...atomicassetsComponents.Collection.properties,
            listings: {type: 'string'},
            volume: {type: 'string'},
            sales: {type: 'string'}
        }
    };

    const AccountResult = {
        type: 'object',
        properties: {
            account: {type: 'string'},
            buy_volume: {type: 'string'},
            sell_volume: {type: 'string'}
        }
    };

    const SchemaResult = {
        type: 'object',
        properties: {
            schema_name: {type: 'string'},
            listings: {type: 'string'},
            volume: {type: 'string'}
        }
    };

    return {
        tag: {
            name: 'stats',
            description: 'Stats'
        },
        paths: {
            '/v1/stats/collections': {
                get: {
                    tags: ['stats'],
                    summary: 'Get market collections sorted by volume or listings',
                    parameters: [
                        {
                            name: 'symbol',
                            in: 'query',
                            description: 'Token Symbol',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        },
                        ...primaryBoundaryParameters,
                        ...dateBoundaryParameters,
                        ...paginationParameters,
                        ...greylistFilterParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['volume', 'listings'],
                                default: 'volume'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            symbol: SymbolResult,
                            results: {type: 'array', items: CollectionResult}
                        }
                    })
                }
            },
            '/v1/stats/collections/{collection_name}': {
                get: {
                    tags: ['stats'],
                    summary: 'Get market collections sorted by volume or listings',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Collection Name',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            name: 'symbol',
                            in: 'query',
                            description: 'Token Symbol',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            symbol: SymbolResult,
                            results: {type: 'array', items: CollectionResult}
                        }
                    })
                }
            },
            '/v1/stats/accounts': {
                get: {
                    tags: ['stats'],
                    summary: 'Get market collections sorted by volume or listings',
                    parameters: [
                        {
                            name: 'symbol',
                            in: 'query',
                            description: 'Token Symbol',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        },
                        ...primaryBoundaryParameters,
                        ...dateBoundaryParameters,
                        ...greylistFilterParameters,
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['buy_volume', 'sell_volume'],
                                default: 'buy_volume'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            symbol: SymbolResult,
                            results: {type: 'array', items: AccountResult}
                        }
                    })
                }
            },
            '/v1/stats/accounts/{account}': {
                get: {
                    tags: ['stats'],
                    summary: 'Get market collections sorted by volume or listings',
                    parameters: [
                        {
                            name: 'account',
                            in: 'path',
                            description: 'Account Name',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            name: 'symbol',
                            in: 'query',
                            description: 'Token Symbol',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        },
                        ...greylistFilterParameters
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            symbol: SymbolResult,
                            result: {type: 'array', items: AccountResult}
                        }
                    })
                }
            },
            '/v1/stats/schemas/{collection_name}': {
                get: {
                    tags: ['stats'],
                    summary: 'Get market schemas sorted by volume or listings',
                    parameters: [
                        {
                            name: 'collection_name',
                            in: 'path',
                            description: 'Collection Name',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            name: 'symbol',
                            in: 'query',
                            description: 'Token Symbol',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        },
                        ...primaryBoundaryParameters,
                        ...dateBoundaryParameters,
                        ...paginationParameters,
                        {
                            name: 'sort',
                            in: 'query',
                            description: 'Column to sort',
                            required: false,
                            schema: {
                                type: 'string',
                                enum: ['volume', 'listings'],
                                default: 'volume'
                            }
                        }
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            symbol: SymbolResult,
                            results: {type: 'array', items: SchemaResult}
                        }
                    })
                }
            },
            '/v1/stats/graph': {
                get: {
                    tags: ['stats'],
                    summary: 'Get history of volume and',
                    parameters: [
                        {
                            name: 'symbol',
                            in: 'query',
                            description: 'Token Symbol',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        },
                        ...greylistFilterParameters
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            symbol: SymbolResult,
                            results: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        time: {type: 'string'},
                                        volume: {type: 'string'},
                                        sales: {type: 'string'},
                                        max: {type: 'string'}
                                    }
                                }
                            }
                        }
                    })
                }
            },
            '/v1/stats/sales': {
                get: {
                    tags: ['stats'],
                    summary: 'Get total sales and volume',
                    parameters: [
                        {
                            name: 'symbol',
                            in: 'query',
                            description: 'Token Symbol',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        },
                        ...greylistFilterParameters
                    ],
                    responses: getOpenAPI3Responses([200, 500], {
                        type: 'object',
                        properties: {
                            symbol: SymbolResult,
                            results: {
                                type: 'object',
                                properties: {
                                    volume: {type: 'string'},
                                    sales: {type: 'string'}
                                }
                            }
                        }
                    })
                }
            }
        }
    };
}
