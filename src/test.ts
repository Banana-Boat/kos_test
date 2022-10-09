import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import path from "path";
import fs from "fs";
import ejs from "ejs";

interface IDiffLog {
  eachPlayer: {
    player1: string[];
    player2: string[];
  };
  eachStep: string[];
  totalStep: number;
}

// 测试单个玩家相邻回合间的差异
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
      path.join(outputDirPath, `${i - 1}.png`),
      PNG.sync.write(outputImg)
    );
    result.push(`${((diff / pixelTotal) * 100).toPrecision(3)}%`);

    lastImg = img;
  }

  return result;
};

// 生成检测报告
const generateReport = (
  diffLog: IDiffLog,
  imgDirPath1: string,
  imgDirPath2: string,
  diffImgPathOfEachStep: string,
  diffImgPath1: string,
  diffImgPath2: string
) => {
  const list = new Array<string>(diffLog.totalStep).fill("");
  const _list = new Array<string>(diffLog.totalStep - 1).fill("");

  const imgList1 = list.map((_, idx) => path.join(imgDirPath1, `${idx}.png`));
  const imgList2 = list.map((_, idx) => path.join(imgDirPath2, `${idx}.png`));
  const diffImgListOfEachStep = list.map((_, idx) =>
    path.join(diffImgPathOfEachStep, `${idx}.png`)
  );
  const diffImgList1 = _list.map((_, idx) =>
    path.join(diffImgPath1, `${idx}.png`)
  );
  const diffImgList2 = _list.map((_, idx) =>
    path.join(diffImgPath2, `${idx}.png`)
  );

  const templateStr = fs
    .readFileSync(path.join(__dirname, "template.ejs"))
    .toString();
  const reportStr = ejs.render(templateStr, {
    diffLog: diffLog,
    imgList1: imgList1,
    imgList2: imgList2,
    diffImgListOfEachStep: diffImgListOfEachStep,
    diffImgList1: diffImgList1,
    diffImgList2: diffImgList2,
  });
  return reportStr;
};

(() => {
  try {
    const tempDirPath = path.join(__dirname, "../temp");
    const tempDir = fs.readdirSync(tempDirPath);
    if (tempDir.find((name) => name === "diff"))
      throw new Error("请先清空缓存（删除 temp/diff 目录）");

    const [imgDirName1, imgDirName2] = tempDir;
    const imgDirPath1 = path.join(tempDirPath, imgDirName1);
    const imgDirPath2 = path.join(tempDirPath, imgDirName2);
    const imgTotal = fs.readdirSync(imgDirPath1).length;

    const diffDirPath = path.join(tempDirPath, "diff");
    fs.mkdirSync(diffDirPath);

    const diffLog: IDiffLog = {
      eachPlayer: {
        player1: [],
        player2: [],
      },
      eachStep: [],
      totalStep: imgTotal,
    };

    // 检验两玩家每回合的差异
    const diffImgPathOfEachStep = path.join(diffDirPath, "each-step");
    fs.mkdirSync(diffImgPathOfEachStep);
    for (let i = 0; i < imgTotal; i++) {
      const img1 = PNG.sync.read(
        fs.readFileSync(path.join(imgDirPath1, `${i.toString()}.png`))
      );
      const img2 = PNG.sync.read(
        fs.readFileSync(path.join(imgDirPath2, `${i.toString()}.png`))
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
        path.join(diffImgPathOfEachStep, `${i}.png`),
        PNG.sync.write(outputImg)
      );
      diffLog.eachStep.push(`${((diff / pixelTotal) * 100).toPrecision(3)}%`);
    }

    // 检测单个玩家相邻回合间的差异
    const diffImgPath1 = path.join(diffDirPath, imgDirName1);
    diffLog.eachPlayer.player1 = testEachPlayer(
      imgDirPath1,
      imgTotal,
      diffImgPath1
    );
    const diffImgPath2 = path.join(diffDirPath, imgDirName2);
    diffLog.eachPlayer.player2 = testEachPlayer(
      imgDirPath2,
      imgTotal,
      diffImgPath2
    );

    // 保存 diff 记录
    fs.writeFileSync(
      path.join(diffDirPath, "diff-log.json"),
      JSON.stringify(diffLog)
    );

    // 生成检测报告，路径需要为result/report.html的相对路径
    const reportHTML = generateReport(
      diffLog,
      `../temp/${imgDirName1}`,
      `../temp/${imgDirName2}`,
      `../temp/diff/each-step`,
      `../temp/diff/${imgDirName1}`,
      `../temp/diff/${imgDirName2}`
    );
    const resDirPath = path.join(__dirname, "../result");
    if (!fs.existsSync(resDirPath)) fs.mkdirSync(resDirPath);
    fs.writeFileSync(path.join(resDirPath, "report.html"), reportHTML);

    console.log("检测完毕，结果已保存至 result/report.html");
  } catch (err) {
    console.error(err);
  }
})();
