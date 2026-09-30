// J02 — understand/reconstruct, inspect known/unknowns (field subset).
// The project tab: work packages, activities, schedule folds, the
// known/unknown discipline surface.
const { expectVisible, launchApp, openTab, signIn } = require('./helpers');

describe('J02 understand / inspect (field subset)', () => {
  beforeAll(async () => {
    await launchApp();
    await signIn();
  });

  it('projects the fixture work packages (the field surface)', async () => {
    await openTab('tab-project');
    await expectVisible('work-package-work-package:warehouse-substructure');
    await expectVisible('work-package-work-package:warehouse-superstructure');
  });

  it('surfaces the known/unknown discipline (uncertainty on every capture)', async () => {
    await expectVisible('project-unknowns');
  });
});
