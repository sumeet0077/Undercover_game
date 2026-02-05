describe('Server Sanity Check', () => {
  test('should pass a basic truthy test', () => {
    expect(true).toBe(true);
  });

  test('should compute basic math', () => {
    expect(1 + 1).toBe(2);
  });
});
