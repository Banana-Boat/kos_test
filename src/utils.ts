export const sleep = (delay: number) => {
  let start = new Date().getTime();
  while (new Date().getTime() - start < delay) continue;
};
