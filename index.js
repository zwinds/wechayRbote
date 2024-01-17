const express = require("express");
const { Wechaty, WechatyBuilder, ScanStatus } = require("wechaty");
const QRCode = require("qrcode-svg");

const app = express();

const logMessages = [];
let qrCodeSvg;

const onLogout = (user) => {
  console.log(`用户 ${user} 退出成功`);
};

const onLogin = async (user) => {
  console.log(`用户 ${user} 登录成功`);
};

const onError = console.error;

const onScan = (code, status) => {
  if (status === ScanStatus.Waiting) {
    const qrcode = new QRCode({
      content: code,
      padding: 4,
      width: 300,
      height: 300,
    });

    qrCodeSvg = qrcode.svg();
    console.log("请访问 http://localhost:3006/qrcode 查看二维码");
  }
};

const forwardFriendMessageToGroups = async (message, targetFriends, targetGroups) => {
  try {
    console.log('消息类型：', message.type());
    console.log('消息发送者备注名：', await message.talker().alias());

    const senderAlias = await message.talker().alias();

    if (targetFriends.includes(senderAlias) && message.room() === undefined) {
      console.log('消息来自指定好友私发');

      for (const targetGroupName of targetGroups) {
        const targetGroup = await wechaty.Room.find({ topic: targetGroupName });

        if (targetGroup) {
          if (message.type() === wechaty.Message.Type.Text) {
            await targetGroup.say(message.text());
            console.log(`已将文本： ${senderAlias} 发到 ${targetGroupName}`);
          } else if (message.type() === wechaty.Message.Type.Url) {
            const urlLink = await message.toUrlLink();
            await targetGroup.say(urlLink);
            console.log(`已将链接：${senderAlias} 发到 ${targetGroupName}`);
          } else if (message.type() === wechaty.Message.Type.Image) {
            const fileBox = await message.toFileBox();
            const imageUrl = fileBox.toBase64();
            await targetGroup.say(new Wechaty.Message.Image(imageUrl));
            console.log(`已将图片： ${senderAlias} 发到 ${targetGroupName}`);
          } else {
            console.log('不支持的类型:', message);
          }
        } else {
          console.log(`未找到指定群聊 ${targetGroupName}`);
        }
      }
    }
  } catch (error) {
    console.error("转发消息到群聊时出错:", error);
  }
};

const onFriendRequest = async (friendRequest) => {
  console.log(`接收到好友请求：${friendRequest.contact().name()}，自动同意并邀请加入群聊`);

  try {
    setTimeout(async () => {
      await friendRequest.accept();

      const targetGroupName = '填邀请人加入群的群名称';
      const targetGroup = await wechaty.Room.find({ topic: targetGroupName });

      if (targetGroup) {
        setTimeout(async () => {
          await targetGroup.add(friendRequest.contact());
          console.log(`已邀请 ${friendRequest.contact().name()} 加入群聊 ${targetGroupName}`);
        }, 3000);
      } else {
        console.log(`未找到指定群聊 ${targetGroupName}`);
      }
    }, 4000);
  } catch (error) {
    console.error("处理好友请求时出错:", error);
  }
};

const wechaty = WechatyBuilder.build();

const targetFriends = ['备注的管理员的名称', '备注的管理员的名称'];
const targetGroups = ['转发到群的名称', '转发到群的名称'];

wechaty
  .on("scan", onScan)
  .on("login", onLogin)
  .on("logout", onLogout)
  .on("error", onError)
  .on('message', message => {
    console.log('收到消息：' + message);
    forwardFriendMessageToGroups(message, targetFriends, targetGroups);
  })
  .on('friendship', onFriendRequest);

wechaty.start();

// Express route to display the QR code in SVG format
app.get("/qrcode", (req, res) => {
  if (qrCodeSvg) {
    res.send("<h1>Wechaty Bot QR Code:</h1>" + qrCodeSvg);
  } else {
    res.send("<h1>No QR Code available yet. Please wait...</h1>");
  }
});

// Express route to display log messages
app.get("/logs", (req, res) => {
  res.send("<h1>Wechaty Bot Logs:</h1><pre>" + logMessages.join("\n") + "</pre>");
});

const server = app.listen(3006, () => {
  console.log("Web server is running on port 3006");
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await wechaty.stop();
  server.close();
  process.exit();
});