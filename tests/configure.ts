import fs from "fs";

export const makeTestRunner = (filename: string) => {
  const file = fs.readFileSync(filename, "utf-8");
  let currentTestId = 0;

  const codes = [...file.matchAll(/makeTest\((\s*(async|)\s*\([a-zA-Z0-9_]*\)\s*=>\s*((.|\s)*?),(.|\s)*?);/gm)].map(
    (r) => r[1]
  );

  return async (
    fn: (f: jest.Mock<any, any>) => Promise<any>,
    compare: (r: ReturnType<typeof expect>, f: jest.Mock<any, any>) => any
  ) => {
    test(codes[currentTestId++] ?? "", async () => {
      const f = jest.fn();
      compare(expect(await fn(f)), f);
    });
  };
};
