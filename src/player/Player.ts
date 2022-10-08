import { CDPSession, KeyInput, Page } from "puppeteer";
import { DirectionType, operMap, PlayerInfoType } from "./types";
import { UrlOfApi } from "./constants";
import { sleep } from "../utils";
import * as fs from "fs";
import path from "path";

export class Player {
  page: Page;
  playerInfo: PlayerInfoType;
  client: CDPSession | null;
  id: string;
  curStep: number;
  picPath: string;
  operList: DirectionType[];

  constructor(page: Page, playerInfo: PlayerInfoType) {
    this.page = page;
    this.playerInfo = playerInfo;
    this.client = null;
    this.id = "";
    this.picPath = "";
    this.curStep = 0;
    this.operList = [];
  }

  /**
   * 初始化WebSocket监听设置
   */
  async initSocketListener() {
    const client = await this.page.target().createCDPSession();
    client.send("Network.enable");
    this.client = client;
  }

  /**
   * 获取websocket响应（JSON格式）
   */
  getSocketResponse() {
    return new Promise<{ event: string; [x: string]: any }>((resolve) => {
      if (!this.client) throw new Error();
      this.client.on("Network.webSocketFrameReceived", (params) => {
        resolve(JSON.parse(params.response.payloadData));
      });
    });
  }

  /**
   * 对画布截图
   */
  async getCanvasScreenshot() {
    const canvas = await this.page.waitForSelector("canvas");
    if (!this.picPath) throw new Error();
    await canvas?.screenshot({
      path: path.join(this.picPath, `${this.curStep.toString()}.png`),
    });
    console.log(`第${this.curStep + 1}回合截图保存成功`);
  }

  /**
   * 获得蛇操作路径
   */
  getOperListOfSnake = (
    map: number[][],
    isPlayerA: boolean
  ): DirectionType[] => {
    const isInMap = (r: number, c: number) => {
      return r >= 1 && r <= 12 && c >= 1 && c <= 13;
    };

    const dfs = (r: number, c: number, tempList: DirectionType[]) => {
      if (!isInMap(r, c) || map[r][c] == 1 || tempList.length > 15)
        return tempList;

      let tempTotal: number[][] = [];
      if (tempList.at(-1) !== DirectionType.DOWN)
        tempTotal.push(dfs(r - 1, c, [...tempList, DirectionType.UP]));
      if (tempList.at(-1) !== DirectionType.UP)
        tempTotal.push(dfs(r + 1, c, [...tempList, DirectionType.DOWN]));
      if (tempList.at(-1) !== DirectionType.RIGHT)
        tempTotal.push(dfs(r, c - 1, [...tempList, DirectionType.LEFT]));
      if (tempList.at(-1) !== DirectionType.LEFT)
        tempTotal.push(dfs(r, c + 1, [...tempList, DirectionType.RIGHT]));

      let maxIdx = 0,
        maxLen = 0;
      for (let i = 0; i < 3; i++) {
        if (tempTotal[i].length > maxLen) {
          maxLen = tempTotal[i].length;
          maxIdx = i;
        }
      }
      return tempTotal[maxIdx];
    };

    let resList1: number[], resList2: number[];
    if (isPlayerA) {
      resList1 = dfs(10, 1, [DirectionType.UP]);
      resList2 = dfs(11, 2, [DirectionType.RIGHT]);
    } else {
      resList1 = dfs(2, 12, [DirectionType.DOWN]);
      resList2 = dfs(1, 11, [DirectionType.LEFT]);
    }
    return resList1.length > resList2.length ? resList1 : resList2;
  };

  /**
   * 玩家登录
   */
  async login() {
    // 打开登录窗口
    const openDrawerBtn = await this.page.waitForSelector(
      ".header .el-button:first-of-type"
    );
    await openDrawerBtn?.click();

    // 输入用户信息并登录
    await this.page.waitForSelector("input");
    const loginBtn = await this.page.waitForSelector(".login-btn");
    const [nameInput, pswInput] = await this.page.$$("input");
    await nameInput.type(this.playerInfo.name);
    await pswInput.type(this.playerInfo.password);
    await loginBtn?.click();

    // 等待至用户信息返回，保存用户Id
    const res = await this.page.waitForResponse(async (res) => {
      // 可能为预检请求，需要判断
      if (
        res.url() === UrlOfApi.getUserInfo &&
        (await res.request()).method() === "GET"
      )
        return true;
      else return false;
    });
    this.id = (await res.json()).id;

    console.log("登录成功");
  }

  /**
   * 进行匹配
   */
  async match() {
    await this.initSocketListener();
    const matchBtn = await this.page.waitForSelector(".match-btn");
    sleep(1000); // 等待抽屉被关闭
    await matchBtn?.click();

    console.log("开始匹配");

    // 等待获取匹配成功的消息，保存游戏地图
    const res = await this.getSocketResponse();
    if (res.event !== "start-matching") throw new Error();
    res.game.map;
    this.operList = this.getOperListOfSnake(
      res.game.map,
      this.id === res.game.a_id.toString()
    );
    console.log("操作序列", this.operList);

    // 创建文件夹用于存放截图
    const dirName = `${res.game.a_id}_${res.game.b_id}_${this.id}_${new Date()
      .getTime()
      .toString()
      .slice(-5)}`;
    const dirPath = path.join(__dirname, `../../result/${dirName}`);
    fs.mkdirSync(dirPath);
    this.picPath = dirPath;

    console.log("匹配成功，对战开始");
  }

  /**
   * 进行对战
   */
  async game() {
    let res: any;

    do {
      sleep(1000);
      await this.getCanvasScreenshot();
      const operation = this.operList[this.curStep];
      await this.page.keyboard.press(operMap.get(operation) as KeyInput);
      this.curStep++;
      res = await this.getSocketResponse();
    } while (res.event !== "result" && this.curStep < this.operList.length);

    console.log("对战结束");
  }
}
