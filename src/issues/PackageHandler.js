'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const vmaas = require('../connectors/vmaas');
const packageResolver = new(require('../resolutions/resolvers/PackageResolver'))();
const cveFactory = new(require('../generator/factories/CVEFactory'))();

module.exports = class PackageHandler extends Handler {

    getIssueDetailsInternal (id) {
        return vmaas.getPackage(id.issue);
    }

    async getIssueDetails (id) {
        const raw = await this.getIssueDetailsInternal(id);

        if (!raw) {
            throw errors.unknownIssue(id);
        }

        return {
            description: id.issue,
            raw
        };
    }

    getResolutionResolver () {
        return packageResolver;
    }

    getPlayFactory () {
        return cveFactory;
    }
};
