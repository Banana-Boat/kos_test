import puppeteer from "puppeteer";
import { Player } from "./player/Player";
import { PlayerInfoType } from "./player/types";

export const main = async (playerInfo: PlayerInfoType) => {
  const browser = await puppeteer.launch({ headless: false });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1000,
      height: 800,
      deviceScaleFactor: 1,
    });
    await page.goto("http://1.15.175.5/");

    const player = new Player(page, playerInfo);

    await player.login();
    await player.match();
    await player.game();
  } catch (err) {
    console.log(err);
  } finally {
    setTimeout(() => {
      browser.close();
    }, 8000);
  }
};
