'use strict';

const assert = require('assert');
const _ = require('lodash');
const cls = require('../../util/cls');
const log = require('../../util/log');
const {host, insecure, revalidationInterval} = require('../../config').compliance;

const Connector = require('../Connector');
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName(), 'getRule');
        this.metrics = metrics.createConnectorMetric(this.getName(), 'getTemplates');
    }

    async getRule (id, refresh = false, retries = 2) {
        id = id.replace(/\./g, '-'); // compliance API limitation

        const req = cls.getReq();

        const uri = this.buildUri(host, 'compliance', 'rules', id);

        try {
            const result = await this.doHttp({
                uri: uri.toString(),
                method: 'GET',
                json: true,
                rejectUnauthorized: !insecure,
                headers: {
                    ...this.getForwardedHeaders()
                }
            },
            {
                key: `remediations|http-cache|compliance|${req.user.account_number}|${id}`,
                refresh,
                revalidationInterval
            },
            this.metrics);

            return _.get(result, 'data.attributes', null);
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, id, retries }, 'Compliance fetch failed. Retrying');
                return this.getRule(id, true, retries - 1);
            }

            throw e;
        }
    }

    async getTemplates (ids, retries = 2) {
        const uri = this.buildUri(host, 'compliance', 'templates'); // CHANGE THIS WHEN API IS CREATED

        let result = null;

        try {
            result = await this.doHttp({
                uri: uri.toString(),
                method: 'POST',
                json: true,
                rejectUnauthorized: !insecure,
                headers: this.getForwardedHeaders(),
                body: { ids }
            }, false, this.metrics);
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, ids, retries }, 'Compliance post failed. Retrying');
                return this.getTemplates(ids, true, retries - 1);
            }

            throw e;
        }

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async ping () {
        const result = await this.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', true);
        assert(result !== null);
    }
}();

