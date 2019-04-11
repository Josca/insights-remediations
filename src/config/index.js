'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const env = process.env;

/* eslint no-process-env: off */
function parseIntEnv (name, defaultValue) {
    if (typeof name !== 'string') {
        throw new Error(`invalid key ${name}`);
    }

    const value = env[name]; // eslint-disable-line security/detect-object-injection
    if (value === undefined) {
        return defaultValue;
    }

    const parsed = parseInt(value);

    if (isNaN(parsed)) {
        throw new Error(`invalid value ${name}=${value}`);
    }

    return parsed;
}

const config = {

    /*
     * Server configuration
     */
    env: env.NODE_ENV || 'development',
    port: (env.NODE_ENV === 'test') ? 9003 : 9002,
    commit: env.OPENSHIFT_BUILD_COMMIT,
    demo: (env.DEMO_MODE === 'true') ? true : false,

    bodyParserLimit: env.BODY_PARSER_LIMIT || '100kb',

    // by default enabled in non-prod
    validateResponseStrict: env.VALIDATE_RESPONSE_STRICT === undefined ?
        env.NODE_ENV !== 'production' :
        env.VALIDATE_RESPONSE_STRICT === 'true' ? true : false,

    path: {
        prefix: env.PATH_PREFIX || '/api',
        app: env.APP_NAME || 'remediations'
    },

    logging: {
        level: env.LOG_LEVEL || ((env.NODE_ENV === 'test') ? 'error' : 'debug'),
        pretty: (env.NODE_ENV !== 'production')
    },

    metrics: {
        prefix: env.METRICS_PREFIX || 'remediations_',
        enabled: env.METRICS_ENABLED === 'false' ? false : true,
        summaryMaxAge: parseIntEnv('METRICS_SUMMARY_MAX_AGE', 10 * 60) // 10 mins
    },

    /*
     * Connector configuration
     */

    // general timeout for HTTP invocations of external services
    requestTimeout: parseInt(env.REQUEST_TIMEOUT) || 10000,

    cache: {
        ttl: parseIntEnv('CACHE_TTL', 24 * 60 * 60), // 24 hours
        revalidationInterval: parseIntEnv('CACHE_REVALIDATION_INVERVAL', 10 * 60) // 10 mins
    },

    advisor: {
        impl: env.ADVISOR_IMPL,
        host: env.ADVISOR_HOST || 'http://insights-advisor-api.advisor-ci.svc.cluster.local:8000',
        auth: env.ADVISOR_AUTH || '',
        insecure: (env.ADVISOR_INSECURE === 'true') ? true : false,
        revalidationInterval: parseIntEnv('ADVISOR_REVALIDATION_INVERVAL', 60 * 60) // 1 hour
    },

    cac: {
        impl: env.CAC_IMPL,
        host: env.CAC_HOST || 'http://localhost:8090'
    },

    compliance: {
        impl: env.COMPLIANCE_IMPL,
        host: env.COMPLIANCE_HOST || 'http://compliance-backend.compliance-ci.svc.cluster.local:3000',
        insecure: (env.COMPLIANCE_INSECURE === 'true') ? true : false,
        revalidationInterval: parseIntEnv('COMPLIANCe_REVALIDATION_INVERVAL', 60 * 60) // 1 hour
    },

    contentServer: {
        impl: env.CONTENT_SERVER_IMPL,
        host: env.CONTENT_SERVER_HOST || 'http://localhost:8080',
        auth: env.CONTENT_SERVER_AUTH || null,
        insecure: (env.CONTENT_SERVER_INSECURE === 'false') ? false : true,
        revalidationInterval: parseIntEnv('CONTENT_SERVER_REVALIDATION_INVERVAL', 60 * 60) // 1 hour
    },

    inventory: {
        impl: env.INVENTORY_IMPL,
        host: env.INVENTORY_HOST || 'http://insights-inventory.platform-ci.svc.cluster.local:8080',
        insecure: (env.INVENTORY_INSECURE === 'true') ? true : false,
        revalidationInterval: parseIntEnv('INVENTORY_REVALIDATION_INVERVAL', 60 * 15), // 15 mins
        pageSize: parseIntEnv('INVENTORY_PAGE_SIZE', 100)
    },

    ssg: {
        impl: env.SSG_IMPL,
        host: env.SSG_HOST || 'http://localhost:8090'
    },

    users: {
        impl: env.USERS_IMPL,
        host: env.USERS_HOST || 'https://insights-services-pipeline-insights.ext.paas.redhat.com',
        auth: env.USERS_AUTH || '',
        clientId: env.USERS_CLIENT_ID || 'remediations',
        env: env.USERS_ENV || 'prod',
        insecure: (env.USERS_INSECURE === 'true') ? true : false,
        revalidationInterval: parseIntEnv('USERS_REVALIDATION_INVERVAL', 60 * 60 * 12) // 12 hours
    },

    vmaas: {
        impl: env.VMAAS_IMPL,
        host: env.VMAAS_HOST || 'https://webapp-vmaas-stable.1b13.insights.openshiftapps.com',
        revalidationInterval: parseIntEnv('VMAAS_REVALIDATION_INVERVAL', 60 * 60 * 12) // 12 hours
    },

    vulnerabilities: {
        impl: env.VULNERABILITIES_IMPL,
        host: env.VULNERABILITIES_HOST || 'https://access.qa.itop.redhat.com',
        auth: env.VULNERABILITIES_AUTH || '',
        insecure: (env.VULNERABILITIES_INSECURE === 'true') ? true : false
    },

    /*
     * Dependencies
     */
    db: {
        username: env.DB_USERNAME || 'postgres',
        password: env.DB_PASSWORD || 'remediations',
        database: env.DB_DATABASE || 'remediations',
        host: env.DB_HOST || '127.0.0.1',
        dialect: 'postgres',
        logging: true,
        operatorsAliases: false,
        pool: {
            min: 5,
            max: 50
        },
        define: {
            charset: 'utf8',
            timestamps: false,
            underscored: true
        },
        dialectOptions: {}
    },

    redis: {
        enabled: env.REDIS_ENABLED === 'true' ? true : false,
        host: env.REDIS_HOST || 'localhost',
        port: parseIntEnv('REDIS_PORT', 6379),
        password: env.REDIS_PASSWORD || undefined
    }
};

config.path.base = `${config.path.prefix}/${config.path.app}`;

if (env.DB_CA) {
    config.db.ssl = true;
    config.db.dialectOptions.ssl = {
        ca: fs.readFileSync(env.DB_CA) // eslint-disable-line security/detect-non-literal-fs-filename
    };
}

if (['development', 'production', 'test'].includes(config.env)) {
    if (fs.existsSync(path.join(__dirname, `${config.env}.js`))) { // eslint-disable-line security/detect-non-literal-fs-filename
        _.merge(config, require(`./${config.env}`)); // eslint-disable-line security/detect-non-literal-require
    }
}

module.exports = config;
