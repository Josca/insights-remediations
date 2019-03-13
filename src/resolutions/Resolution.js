'use strict';

const Template = require('../templates/Template');
const errors = require('../errors').internal;

function createTemplate (template) {
    if (typeof template === 'string') {
        return new Template(template);
    }

    if (template instanceof Template) {
        return template;
    }

    throw errors.preconditionFailed(`Invalid template type ${typeof template}`);
}

module.exports = class Resolution {

    constructor (
        template,
        type = 'fix',
        description,
        needsReboot = false,
        needsDiagnosis = false,
        resolutionRisk = -1,
        version = 'unknown') {

        this.template = createTemplate(template);
        this.type = type;
        this.needsReboot = needsReboot;
        this.needsDiagnosis = needsDiagnosis;
        this.description = description;
        this.resolutionRisk = resolutionRisk;
        this.version = version;

        if (!this.template.data.includes(Template.HOSTS_PLACEHOLDER)) {
            throw errors.invalidResolution(`Template does not include "${Template.HOSTS_PLACEHOLDER}"`, this.template.data);
        }
    }

    render (parameters) {
        return this.template.render(parameters);
    }
};
