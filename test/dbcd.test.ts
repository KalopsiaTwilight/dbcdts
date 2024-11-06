import { DBCD, GitHubDBDProvider, WagoDBCProvider } from "../src";

import * as mocha from "mocha"
import * as chai from "chai"

const expect = chai.expect;
describe('DBCD', () => {
    it('should be able to read WDC3 files', async function () {
        this.timeout(0);
        var dbdProvider = new GitHubDBDProvider();
        var dbcProvider = new WagoDBCProvider();
        await dbcProvider.init();

        var dbcd = new DBCD(dbcProvider, dbdProvider);
        const result = await dbcd.load<any>('AlliedRace', '9.2.7.45745');

        expect(result.size).to.equal(10);

        const row = result.get(4);
        expect(row.ID).to.equal(4);
        expect(row.RaceID).to.equal(28);
        expect(row.BannerColor).to.equal(13959168);
        expect(row.CrestTextureID).to.equal(6726);
        expect(row.ModelBackgroundTextureID).to.equal(6722);
        expect(row.MaleCreatureDisplayID).to.equal(82733);
        expect(row.FemaleCreatureDisplayID).to.equal(82731);
        expect(row.Ui_unlockAchievementID).to.equal(12445);
        expect(row.Ui_unlockSecondaryAchievementID).to.equal(14884); 
    });
    it('should be able to read WDC3 files with sparse strings', async function () {
        this.timeout(0);
        var dbdProvider = new GitHubDBDProvider();
        var dbcProvider = new WagoDBCProvider();
        await dbcProvider.init();

        var dbcd = new DBCD(dbcProvider, dbdProvider);
        const result = await dbcd.load<any>('ItemSparse', '9.2.7.45745');

        expect(result.size).to.equal(129579);

        const row = result.get(79);
        expect(row.Display_lang).to.equal("Dwarven Cloth Britches");
    });
})