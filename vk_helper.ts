import * as rp from 'request-promise';
import TelegramBot from 'node-telegram-bot-api';

export async function forwardMessageToVk(groupId: number, accessToken: string, bot: TelegramBot, msg: TelegramBot.Message) {
  const getUrl = (method: string, params: string) =>
    `https://api.vk.com/method/${method}?access_token=${accessToken}&v=5.92&${params}`

  const attachments: string[] = [];

  const messageText = msg.text || msg.caption || '';
  const httpRe = /((http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?)/
  const reMatch = messageText.match(httpRe);
  if (reMatch) {
    console.log('Matched!');
    attachments.push(reMatch[0]);
    console.log(attachments);
  }

  if (msg.photo) {
    const getUploadServerResponse =
      await rp.get({ url: getUrl('photos.getWallUploadServer', `group_id=${groupId}`), json: true });

    console.log(getUploadServerResponse);

    const imgUrl = await bot.getFileLink(msg.photo[msg.photo.length - 1].file_id);
    const uploadResponse = await rp.post({
      url: getUploadServerResponse.response.upload_url,
      formData: {
        "photo": rp.get(imgUrl)
      },
      json: true
    });

    console.log(uploadResponse);

    const saveResponse = await rp.get({
      url: getUrl('photos.saveWallPhoto',
        `group_id=${groupId}&hash=${uploadResponse.hash}&server=${uploadResponse.server}&photo=${encodeURIComponent(uploadResponse.photo)}`),
      json: true
    });

    console.log(saveResponse);

    const photoInfo = saveResponse.response[0];
    attachments.push(`photo${photoInfo.owner_id}_${photoInfo.id}`);
  }

  const attachmentsJoined = attachments.join(',');

  return await rp.get({
    url: getUrl('wall.post', `owner_id=-${groupId}&from_group=1&message=${encodeURIComponent(messageText)}&attachments=${attachmentsJoined}`),
    json: true
  });
}
