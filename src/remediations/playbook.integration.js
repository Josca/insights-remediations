'use strict';

const { request, auth, mockDate } = require('../test');

describe('playbooks', function () {
    test('generates playbook with pydata and playbook support', async () => {
        mockDate();
        const {text, headers} = await request
        .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
        .expect(200);

        headers['content-disposition'].should.match(/^attachment;filename="remediation-1-[0-9]+\.yml"$/);
        expect(text).toMatchSnapshot();
    });

    test('generates playbook that does not need reboot', async () => {
        mockDate();
        const {text, headers} = await request
        .get('/v1/remediations/e809526c-56f5-4cd8-a809-93328436ea23/playbook')
        .expect(200);

        headers['content-disposition'].should.match(/^attachment;filename="unnamed-playbook-[0-9]+\.yml"$/);
        expect(text).toMatchSnapshot();
    });

    test('generates playbook with suppressed reboot', async () => {
        mockDate();
        const {text, headers} = await request
        .get('/v1/remediations/178cf0c8-35dd-42a3-96d5-7b50f9d211f6/playbook')
        .expect(200);

        headers['content-disposition'].should.match(/^attachment;filename="remediation-with-suppressed-reboot-[0-9]+\.yml"$/);
        expect(text).toMatchSnapshot();
    });

    test('playbook for remediation with zero issues does not freak out', async () => {
        const {text} = await request
        .get('/v1/remediations/256ab1d3-58cf-1292-35e6-1a49c8b122d3/playbook')
        .expect(204);

        expect(text).toMatchSnapshot();
    });

    describe('caching', function () {
        async function testCaching (desc, id, etag) {
            test (desc, async () => {
                const {headers} = await request
                .get(`/v1/remediations/${id}/playbook`)
                .expect(200);

                headers.etag.should.equal(etag);

                await request
                .get(`/v1/remediations/${id}/playbook`)
                .set('if-none-match', etag)
                .expect(304);
            });
        }

        testCaching('pydata playbook', '66eec356-dd06-4c72-a3b6-ef27d1508a02', 'W/"1f5b-rWfZfjYDuqRQLfvhthi2D4I1AJg"');
        testCaching('no reboot playbook', 'e809526c-56f5-4cd8-a809-93328436ea23', 'W/"944-iFtx+BHAhy9qJeTGQguEagp6NOw"');
        testCaching('playbook with suppressed reboot', '178cf0c8-35dd-42a3-96d5-7b50f9d211f6',
            'W/"be1-rUthu0Xdr4iix21vbFDjKM4qIeQ"');

        test('pydata playbook caching with stale data', async () => {
            await request
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02/playbook')
            .set('if-none-match', 'W/"1e4d-hLarcuq+AQP/rL6nnA70UohsnSI"')
            .expect(200);
        });
    });

    describe('missing', function () {
        test('get remediation with missing system', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/82aeb63f-fc25-4eef-9333-4fa7e10f7217/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="missing-system-1-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        test('get remediation with missing system causing an issue to be empty', async () => {
            mockDate();
            const {text, headers} = await request
            .get('/v1/remediations/27e36e14-e1c2-4b5a-9382-ec80ca9a6c1a/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            headers['content-disposition'].should.match(/^attachment;filename="missing-system-2-[0-9]+\.yml"$/);
            expect(text).toMatchSnapshot();
        });

        test('get remediation with unknown resolution', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/ea5b1507-4cd3-4c87-aa5a-6c755d32a7bd/playbook')
            .set(auth.testReadSingle)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('get remediation with unknown issues', async () => {
            mockDate();
            const {text} = await request
            .get('/v1/remediations/62c95092-ac83-4025-a676-362a67e68579/playbook')
            .set(auth.testReadSingle)
            .expect(204);

            expect(text).toMatchSnapshot();
        });
    });
});
