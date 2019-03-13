'use strict';

const errors = require('../errors');
const PATTERN = /^(advisor|vulnerabilities|compliance|ssg|test):([\w\d-_|:\\.]+)$/;
const SSG_PATTERN = /^([a-z0-9_-]+)\|([a-z0-9_-]+)\|xccdf_org\.ssgproject\.content_rule_([a-z0-9_-]+)$/;

function match (id) {
    const match = PATTERN.exec(id);
    if (!match) {
        throw errors.invalidIssueId(id);
    }

    return match;
}

exports.validate = match;

exports.Identifier = class Identifier {
    constructor (app, issue, full) {
        this.app = app;
        this.issue = issue;
        this.full = full;
    }

    toString () {
        return this.full;
    }
};

exports.parse = function (id) {
    const result = match(id);

    return new exports.Identifier(result[1], result[2], id);
};

exports.parseSSG = function (id) {
    if (!(id instanceof exports.Identifier)) {
        id = exports.parse(id);
    }

    const result = SSG_PATTERN.exec(id.issue);

    if (!result.length === 4) {
        throw errors.invalidIssueId(id);
    }

    return {
        platform: result[1],
        profile: result[2],
        rule: result[3],
        ruleRef: `xccdf_org.ssgproject.content_rule_${result[3]}`
    };
};

exports.toExternal = id => match(id)[2];
