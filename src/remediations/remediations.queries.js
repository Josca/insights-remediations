'use strict';

const db = require('../db');
const {NULL_NAME_VALUE} = require('./models/remediation');
const _ = require('lodash');

const REMEDIATION_ATTRIBUTES = [
    'id',
    'name',
    'auto_reboot',
    'account_number',
    'created_by',
    'created_at',
    'updated_by',
    'updated_at'
];
const ISSUE_ATTRIBUTES = ['issue_id', 'resolution'];
const PLAYBOOK_RUN_ATTRIBUTES = [
    'id',
    'status',
    'remediation_id',
    'created_by',
    'created_at',
    'updated_at'
];

function systemSubquery (system_id) {
    const {s: { dialect, col, literal }, fn: { DISTINCT }, issue, issue_system} = db;
    const generator = dialect.QueryGenerator;

    const query = {
        attributes: [DISTINCT(col('remediation_id'))],
        include: [{
            attributes: [],
            association: issue.associations.systems,
            model: issue_system,
            required: true,
            where: { system_id }
        }]
    };

    issue._validateIncludedElements(query);

    // generate sql and remove trailing ";"
    const sql = generator.selectQuery([[db.issue.tableName, db.issue.name]], query).slice(0, -1);
    return literal(`(${sql})`);
}

exports.list = function (
    account_number,
    created_by,
    system = false,
    primaryOrder = 'updated_at',
    asc = true,
    filter = false,
    limit,
    offset) {

    const {Op, s: {literal, where, col, cast}, fn: { DISTINCT, COUNT}} = db;

    const query = {
        attributes: [
            'id',
            [cast(COUNT(DISTINCT(col('issues.id'))), 'int'), 'issue_count'],
            [cast(COUNT(DISTINCT(col('issues->systems.system_id'))), 'int'), 'system_count']
        ],
        include: [{
            attributes: [],
            model: db.issue,
            required: false,
            include: [{
                attributes: [],
                association: db.issue.associations.systems,
                required: true
            }]
        }],
        where: {
            account_number,
            created_by
        },
        group: ['remediation.id'],
        order: [
            [col(primaryOrder), asc ? 'ASC' : 'DESC'],
            ['id', 'ASC']
        ],
        subQuery: false,
        limit,
        offset,
        raw: true
    };

    if (system) {
        query.where.id = {
            [Op.in]: systemSubquery(system)
        };
    }

    if (filter) {
        filter = `%${filter}%`;

        query.where[Op.or] = [{
            name: {
                [Op.iLike]: filter
            }
        }, {
            [Op.and]: [
                {
                    name: null
                },
                where(literal(db.s.escape(NULL_NAME_VALUE)), Op.iLike, filter)
            ]
        }];
    }

    return db.remediation.findAndCountAll(query);
};

exports.loadDetails = async function (account_number, created_by, rows) {
    const {Op, s: {literal}} = db;

    const query = {
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            required: false,
            where: literal(
                // exclude issues with 0 systems
                // eslint-disable-next-line max-len
                'EXISTS (SELECT * FROM "remediation_issue_systems" WHERE "remediation_issue_systems"."remediation_issue_id" = "issues"."id")'
            )
        }],
        where: {
            account_number,
            created_by,
            id: {
                [Op.in]: _.map(rows, 'id')
            }
        }
    };

    const results = await db.remediation.findAll(query);
    const byId = _.keyBy(results, 'id');

    return rows.map(row => _.assign(byId[row.id].toJSON(), row));
};

exports.get = function (id, account_number, created_by) {
    return db.remediation.findOne({
        attributes: REMEDIATION_ATTRIBUTES,
        include: [{
            attributes: ISSUE_ATTRIBUTES,
            model: db.issue,
            include: {
                attributes: ['system_id'],
                association: db.issue.associations.systems,
                required: true
            }
        }],
        where: {
            id, account_number, created_by
        },
        order: [
            ['id'],
            [db.issue, 'issue_id'],
            [db.issue, db.issue.associations.systems, 'system_id']
        ]
    });
};

exports.getPlaybookRuns = function (id, account_number, created_by) {
    const {s: {col, cast}, fn: {DISTINCT, COUNT}} = db;

    return db.remediation.findOne({
        attributes: [],
        include: [{
            attributes: PLAYBOOK_RUN_ATTRIBUTES,
            model: db.playbook_runs,
            include: [{
                attributes: [
                    'executor_id',
                    'executor_name',
                    [cast(COUNT(DISTINCT(col('playbook_runs->executors->systems.id'))), 'int'),
                        'system_count']],
                model: db.playbook_run_executors,
                as: 'executors',
                include: [{
                    attributes: [],
                    model: db.playbook_run_systems,
                    as: 'systems'
                }]
            }]
        }],
        where: {
            id, account_number, created_by
        },
        group: [
            'remediation.id',
            'playbook_runs.id',
            'playbook_runs->executors.id'
        ],
        order: [
            [db.playbook_runs, 'created_at', 'DESC']
        ]
    });
};

exports.getRunDetails = function (id, playbook_run_id, account_number, created_by) {
    const {s: {col, cast}, fn: {DISTINCT, COUNT}} = db;

    return db.remediation.findOne({
        attributes: [],
        include: [{
            attributes: PLAYBOOK_RUN_ATTRIBUTES,
            model: db.playbook_runs,
            where: {
                id: playbook_run_id
            },
            include: [{
                attributes: [
                    'executor_id',
                    'executor_name',
                    'status',
                    'updated_at',
                    'playbook',
                    'playbook_run_id',
                    [cast(COUNT(DISTINCT(col('playbook_runs->executors->systems.id'))), 'int'),
                        'system_count']],
                model: db.playbook_run_executors,
                as: 'executors',
                include: [{
                    attributes: [],
                    model: db.playbook_run_systems,
                    as: 'systems'
                }]
            }]
        }],
        where: {
            id, account_number, created_by
        },
        group: [
            'remediation.id',
            'playbook_runs.id',
            'playbook_runs->executors.id'
        ],
        order: [
            [db.remediation.associations.playbook_runs, db.playbook_runs.associations.executors, 'executor_name', 'ASC']
        ]
    });
};

exports.getSystems = function (remediation_id, playbook_run_id, executor_id = null, account, username) {
    const query = {
        attributes: [
            'id',
            'system_id',
            'system_name',
            'status',
            'updated_at',
            'playbook_run_executor_id'
        ],
        include: [{
            attributes: ['id'],
            model: db.playbook_run_executors,
            required: true,
            include: [{
                attributes: ['id'],
                model: db.playbook_runs,
                include: [{
                    attributes: ['id'],
                    model: db.remediation,
                    where: {
                        id: remediation_id,
                        account_number: account,
                        created_by: username
                    }
                }],
                where: {
                    id: playbook_run_id
                }
            }]
        }],
        order: [
            ['system_name', 'ASC']
        ]
    };

    if (executor_id) {
        query.include[0].where = {
            executor_id
        };
    }

    return db.playbook_run_systems.findAll(query);
};

exports.getSystemDetails = function (id, playbook_run_id, system_id, account_number, created_by) {
    return db.playbook_run_systems.findOne({
        attributes: [
            'id',
            'system_id',
            'system_name',
            'status',
            'updated_at',
            ['playbook_run_executor_id', 'executor_id'],
            'console'
        ],
        include: [{
            attributes: ['id'],
            model: db.playbook_run_executors,
            required: true,
            include: [{
                attributes: ['id'],
                model: db.playbook_runs,
                include: [{
                    attributes: [],
                    model: db.remediation,
                    where: {
                        id, account_number, created_by
                    }
                }],
                where: {
                    id: playbook_run_id
                }
            }]
        }],
        where: {
            system_id
        }
    });
};

exports.insertPlaybookRun = async function (run, executors, systems) {
    await db.s.transaction(async transaction => {
        await db.playbook_runs.create(run, {transaction});
        await db.playbook_run_executors.bulkCreate(executors, {transaction});
        await db.playbook_run_systems.bulkCreate(systems, {transaction});
    });
};
