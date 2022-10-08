/**
 * 阻塞主进程，睡眠指定秒数
 */
export const sleep = (delay: number) => {
  let start = new Date().getTime();
  while (new Date().getTime() - start < delay) continue;
};
