import { CDPSession, Page } from "puppeteer";
import { PlayerInfoType } from "./types";
import { UrlOfApi } from "./constants";
import { sleep } from "../utils";
import * as fs from "fs";
import { join } from "path";

export class Player {
  page: Page;
  playerInfo: PlayerInfoType;
  client: CDPSession | null;
  picPath: string;
  picIndex: number;

  constructor(page: Page, playerInfo: PlayerInfoType) {
    this.page = page;
    this.playerInfo = playerInfo;
    this.client = null;
    this.picPath = "";
    this.picIndex = 0;
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
      path: join(this.picPath, `${this.picIndex.toString()}.png`),
    });
    console.log(`第${this.picIndex + 1}回合截图保存成功`);
    this.picIndex++;
  }

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

    // 等待至用户信息返回
    await this.page.waitForResponse(UrlOfApi.getUserInfo);

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

    // 等待获取匹配成功的消息
    const res = await this.getSocketResponse();
    if (res.event !== "start-matching") throw new Error();

    // 创建文件夹用于存放截图
    const dirPath = join(
      __dirname,
      `../../result/${res.game.a_id}_${res.game.b_id}_${new Date().getTime()}`
    );
    fs.mkdirSync(dirPath);
    this.picPath = dirPath;

    await this.getCanvasScreenshot();

    console.log("匹配成功，对战开始");
  }

  /**
   * 进行对战
   */
  async game() {
    let res = await this.getSocketResponse();

    while (res.event !== "result") {
      res = await this.getSocketResponse();
    }

    await this.getCanvasScreenshot();
  }
}
