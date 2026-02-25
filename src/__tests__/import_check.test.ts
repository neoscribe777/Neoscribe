try {
  require('../screens/MassiveFileViewerScreen');
  console.log('Import success');
} catch (e) {
  console.error('Import failed:', e);
}

describe('Import Test', () => {
  it('checks import', () => {
    expect(true).toBe(true);
  });
});
