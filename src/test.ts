import pixelmatch from "pixelmatch";
import { PNG, PNGWithMetadata } from "pngjs";
import path from "path";
import fs from "fs";

interface IDiffLog {
  eachPlayer: {
    player1: string[];
    player2: string[];
  };
  eachStep: string[];
  totalStep: number;
}

const testEachPlayer = (
  inputDirPath: string,
  total: number,
  outputDirPath: string
): string[] => {
  const result: string[] = [];
  fs.mkdirSync(outputDirPath);
  let lastImg = PNG.sync.read(
    fs.readFileSync(path.join(inputDirPath, "0.png"))
  );

  for (let i = 1; i < total; i++) {
    const img = PNG.sync.read(
      fs.readFileSync(path.join(inputDirPath, `${i.toString()}.png`))
    );

    const { width, height } = img;
    const pixelTotal = width * height;
    const outputImg = new PNG({ width, height });

    const diff = pixelmatch(
      lastImg.data,
      img.data,
      outputImg.data,
      width,
      height
    );

    fs.writeFileSync(
      path.join(outputDirPath, `${i}.png`),
      PNG.sync.write(outputImg)
    );
    result.push(`${((diff / pixelTotal) * 100).toPrecision(3)}%`);

    lastImg = img;
  }

  return result;
};

(() => {
  try {
    const resDirPath = path.join(__dirname, "../temp");
    const resultDir = fs.readdirSync(resDirPath);
    if (resultDir.find((name) => name === "diff"))
      throw new Error("请先清空缓存（删除 temp/diff 目录）");

    const [dirname1, dirname2] = resultDir;
    const dirPath1 = path.join(resDirPath, dirname1);
    const dirPath2 = path.join(resDirPath, dirname2);
    const imgTotal = fs.readdirSync(dirPath1).length;

    const outputDirPath = path.join(resDirPath, "diff");
    fs.mkdirSync(outputDirPath);

    const diffLog: IDiffLog = {
      eachPlayer: {
        player1: [],
        player2: [],
      },
      eachStep: [],
      totalStep: imgTotal,
    };

    // 检验两玩家每回合的差异
    const eachStepDirPath = path.join(outputDirPath, "each-step");
    fs.mkdirSync(eachStepDirPath);
    for (let i = 0; i < imgTotal; i++) {
      const img1 = PNG.sync.read(
        fs.readFileSync(path.join(dirPath1, `${i.toString()}.png`))
      );
      const img2 = PNG.sync.read(
        fs.readFileSync(path.join(dirPath2, `${i.toString()}.png`))
      );

      const { width, height } = img1;
      const pixelTotal = width * height;
      const outputImg = new PNG({ width, height });

      const diff = pixelmatch(
        img1.data,
        img2.data,
        outputImg.data,
        width,
        height
      );

      fs.writeFileSync(
        path.join(eachStepDirPath, `${i}.png`),
        PNG.sync.write(outputImg)
      );
      diffLog.eachStep.push(`${((diff / pixelTotal) * 100).toPrecision(3)}%`);
    }

    // 检测单个玩家相邻回合间的差异
    diffLog.eachPlayer.player1 = testEachPlayer(
      dirPath1,
      imgTotal,
      path.join(outputDirPath, dirname1)
    );
    diffLog.eachPlayer.player2 = testEachPlayer(
      dirPath2,
      imgTotal,
      path.join(outputDirPath, dirname2)
    );

    // 保存 diff 记录
    fs.writeFileSync(
      path.join(outputDirPath, "diff-log.json"),
      JSON.stringify(diffLog)
    );
    console.log("检测完毕，结果已保存至 result/report.html");
  } catch (err) {
    console.error(err);
  }
})();
