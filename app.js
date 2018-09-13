/* jshint node: true, devel: true */
'use strict';

const 
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),  
  request = require('request');

var app = express();
app.set('port', 5000);
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.json({ verify: verifyRequestSignature }));//56~64

/*
 * Open config/default.json and set your config values before running this server.
 * You can restart the *node server* without reconfiguring anything. However, whenever 
 * you restart *ngrok* you will receive a new random url, so you must revalidate your 
 * webhook url in your App Dashboard.
 */

// App Dashboard > Dashboard > click the Show button in the App Secret field
const APP_SECRET = config.get('appSecret');

// App Dashboard > Webhooks > Edit Subscription > copy whatever random value you decide to use in the Verify Token field
const VALIDATION_TOKEN = config.get('validationToken');

// App Dashboard > Messenger > Settings > Token Generation > select your page > copy the token that appears
const PAGE_ACCESS_TOKEN = config.get('pageAccessToken');

// In an early version of this bot, the images were served from the local public/ folder.
// Using an ngrok.io domain to serve images is no longer supported by the Messenger Platform.
// Github Pages provides a simple image hosting solution (and it's free)
const IMG_BASE_PATH = 'https://rodnolan.github.io/posterific-static-images/';

/*app.get('/webhook',function(req,res){
  res.status(200).send(req.query['hub.challenge'])
}); */

// make sure that everything has been properly configured
if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN)) {
  console.error("Missing config values");
  process.exit(1);
}

//code for test webhook is work(Hello server)
/*
app.get('/webhook',function(reg,res){
  res.sendStatus(200)
}); 
*/

// to connect to webhook use this
/* 
app.get('/webhook',function(req,res){
    res.status(200).send(req.query['hub.challenge']);
});
*/


// double check : hub.mode is from facebook and verify_token is set by yourselk 
app.get('/webhook',function(req,res){
  if (req.query['hub.mode' === 'subscribe' && req.query['hub.verify_token'] === 'test']) {
    console.log("[app.get] Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  }else{
    console.error("Failed validation. Validation token mismatch.");
    res.sendStatus(403);
  }
}); 


//be sure the packge is form my fan page
function verifyRequestSignature(reg, res, buf){
  var signature = reg.headers['x-hub-signature']; //facebook's packge will add 'x-hub-signature',so use it to check
  if(!signature){
    console.log("Couldn't verify signature");
  }else{
    var elements = signature.split('=');
    var signatureHash = elements[1];
    var expectedHash = crypto.createHmac('sha1', APP_SECRET).update(buf).digest('hex');
    console.log("received %s", signatureHash);
    console.log("exepected %s", expectedHash);
    if (signatureHash != expectedHash){
      throw new Error ("Couldn't validate the requezt signature.");
    }
  }
}


app.post('/webhook',function(req,res){
  var data = req.body;
  if (data.object == 'page') {  //this message is from fan page
    res.sendStatus(200);
    data.entry.forEach(function(pageEntry) { //the user maybe send no only one message - type
      pageEntry.messaging.forEach(function(messagingEvent) {
        let propertyNames = Object.keys(messagingEvent);
        console.log("[app.post] Webhook event props: ",propertyNames.join());

        if (messagingEvent.message) {   //the user use type to send back)
          processMessageFromPage(messagingEvent);
        }else if (messagingEvent.postback) {  //the user use postback to send back)
          processPostbackMessage(messagingEvent);
        }else { 
          console.log("[app.post] not prepared to handle this message type.")
        }
      });
    });
  }
});

//to process the message from fan page
function processMessageFromPage(event) {
  var senderID = event.sender.id;
  var message = event.message;

  //if the user use quick reply
  if (message.quick_reply){
    console.log("[processMessageFromPage] quick_reply.payload (%s)",message.quick_reply.payload);
    handleQuickReplyResponse(event);
    return;
  }

  var messageText = message.text;
  //process the user's message text
  if (messageText){
    console.log("[processMessangeFromPage]: %s",messageText);
    var lowerCaseMsg = messageText.toLowerCase();
    var turn_lower = lowerCaseMsg.toLowerCase(); 
    switch (turn_lower) {
      case 'help':
         sendHelppOptionsAsQuickReplies(senderID);
          break;
      default:
        sendTextMessage(senderID, messageText);
    } 
  }
}


// now is echo
function sendTextMessage(recipientId ,messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  console.log("[sendTextMessage %s",JSON.stringify(messageData));
  callSendAPI(messageData);
}

//75 call to facebook API
function callSendAPI(messageData){
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: PAGE_ACCESS_TOKEN},
    method: 'POST',
    json : messageData
  },function(error,response,body){ //if it is success
    if (!error && response.statusCode == 200){
      console.log("[callSendAPI] Send API call failed");
    }
  });
}

//process post back message
function processPostbackMessage(event) {
  var senderID = event.sender.id;
  var pageID = event.recipient.id;
  var time0fPostback = event.timestamp;
  var payload = event.postback.payload;

  console.log("[processPostbackFromPage"+"from user (%d) page(%d)" + "timestamp (%d) with payload (%s)",senderID,pageID,time0fPostback,JSON.stringify(payload));

  respondToHelpRequest(senderID,payload);
}

//when the user type help
function sendHelppOptionsAsQuickReplies(recipientId){
  console.log("[sendHe1pOptioncAsQuickReplies] Sending help option menu");
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "快選一隻兔兔吧~",
      quick_replies:[
        {
          "content_type" : "text",
          "title" : "幸福兔兔",
          "payload" : "QR_ROTATION_1"
        },
        {
          "content_type" : "text",
          "title" : "溫暖兔兔",
          "payload" : "QR_PHOTO_1"
        },
        {
          "content_type" : "text",
          "title" : "冷冷兔兔",
          "payload" : "QR_CAPTION_1"
        },
        {
          "content_type" : "text",
          "title" : "黑黑兔兔",
          "payload" : "QR_BACKGROUND_1"
        }
      ]
    }
  };
  callSendAPI(messageData);
}


//108-111
function handleQuickReplyResponse(event) {
  var senderID = event.sender.id;
  var pageID = event.recipient.id;
  var message = event.message;
  var quickReplyPayLoad = message.quick_reply.payload;

  console.log("[handleQuickReplyRespnse] Handling quick reply response (%s)from sender (%d) to page (%d) with message (%s)",quickReplyPayLoad,senderID,pageID,JSON.stringify(message));
  respondToHelpRequest(senderID,quickReplyPayLoad);
}


/*
 * simplify switching between the two help response implementations 
 */
function respondToHelpRequest(senderID, payload) {
  // set useGenericTemplates to false to send image attachments instead of generic templates
  var useGenericTemplates = true; //切換兩種模板
  var messageData;
  
  if (useGenericTemplates) {
    // respond to the sender's help request by presenting a carousel-style 
    // set of screenshots of the application in action 
    // each response includes all the content for the requested feature
    messageData = getGenericTemplates(senderID, payload);
  } else {
    // respond to the help request by presenting one image at a time
    messageData = getImageAttachments(senderID, payload);
  }
  // getImageAttachments may return null 
  if (messageData) {
    callSendAPI(messageData);  
  }
}

/*
 * This response uses templateElements to present the user with a carousel
 * You send ALL of the content for the selected feature and they swipe 
 * left and right to see it
 *
 */
function getGenericTemplates(recipientId, requestForHelpOnFeature) {
  console.log("[getGenericTemplates] handling help request for %s",
    requestForHelpOnFeature);
  var templateElements = [];
  var sectionButtons = [];
  // each button must be of type postback but title
  // and payload are variable depending on which 
  // set of options you want to provide
  var addSectionButton = function(title, payload) {
    sectionButtons.push({
      type: 'postback',
      title: title,
      payload: payload
    });
  }

  // Since there are only four options in total, we will provide 
  // buttons for each of the remaining three with each section. 
  // This provides the user with maximum flexibility to navigate

  switch (requestForHelpOnFeature) {
    case 'QR_ROTATION_1':
      addSectionButton('看溫暖兔兔', 'QR_PHOTO_1');
      addSectionButton('看冷冷兔兔', 'QR_CAPTION_1');
      addSectionButton('看黑黑兔兔', 'QR_BACKGROUND_1');
      
      templateElements.push(
        {
          title: "大紅兔",
          subtitle: "新鮮的生兔兔",
          image_url: IMG_BASE_PATH + "01-rotate-landscape.png",
          buttons: sectionButtons 
        }, 
        {
          title: "粉紅兔",
          subtitle: "烤剛好的粉嫩嫩兔兔",
          image_url: IMG_BASE_PATH + "02-rotate-portrait.png",
          buttons: sectionButtons 
        }
      );
    break; 
    case 'QR_PHOTO_1':
      addSectionButton('看幸福兔兔', 'QR_ROTATION_1');
      addSectionButton('看冷冷兔兔', 'QR_CAPTION_1');
      addSectionButton('看黑黑兔兔', 'QR_BACKGROUND_1');

      templateElements.push(
        {
          title: "黃兔兔",
          subtitle: "用笑容溫暖你",
          image_url: IMG_BASE_PATH + "03-photo-hover.png",
          buttons: sectionButtons 
        }, 
        {
          title: "橘兔",
          subtitle: "曬傷了...",
          image_url: IMG_BASE_PATH + "04-photo-list.png",
          buttons: sectionButtons 
        },
        {
          title: "彩虹兔",
          subtitle: "彩虹彩虹",
          image_url: IMG_BASE_PATH + "05-photo-selected.png",
          buttons: sectionButtons 
        }        
      );
    break; 
    case 'QR_CAPTION_1':
      addSectionButton('看幸福兔兔', 'QR_ROTATION_1');
      addSectionButton('看溫暖兔兔', 'QR_PHOTO_1');
      addSectionButton('看黑黑兔兔', 'QR_BACKGROUND_1');

      templateElements.push(
        {
          title: "白兔",
          subtitle: "黑兔的另一面",
          image_url: IMG_BASE_PATH + "06-text-hover.png",
          buttons: sectionButtons 
        }, 
        {
          title: "紫兔",
          subtitle: "我有毒不要吃我><",
          image_url: IMG_BASE_PATH + "07-text-mid-entry.png",
          buttons: sectionButtons 
        },
        {
          title: "綠兔兔",
          subtitle: "發霉了",
          image_url: IMG_BASE_PATH + "08-text-entry-done.png",
          buttons: sectionButtons 
        },
        {
          title: "藍兔",
          subtitle: "盯著你心裡發寒",
          image_url: IMG_BASE_PATH + "09-text-complete.png",
          buttons: sectionButtons 
        }
      );
    break; 
    case 'QR_BACKGROUND_1':
      addSectionButton('看幸福兔兔', 'QR_ROTATION_1');
      addSectionButton('看溫暖兔兔', 'QR_PHOTO_1');
      addSectionButton('看冷冷兔兔', 'QR_CAPTION_1');

      templateElements.push(
        {
          title: "黑兔",
          subtitle: "不小心烤焦了",
          image_url: IMG_BASE_PATH + "10-background-picker-hover.png",
          buttons: sectionButtons 
        },
        {
          title: "黑兔兔",
          subtitle: "超喜歡玩遊戲了",
          image_url: IMG_BASE_PATH + "11-background-picker-appears.png",
          buttons: sectionButtons 
        },
        {
          title: "黑兔兔兔",
          subtitle: "離家出走未回家",
          image_url: IMG_BASE_PATH + "12-background-picker-selection.png",
          buttons: sectionButtons 
        }, 
        {
          title: "黑兔兔兔兔",
          subtitle: "痾好黑",
          image_url: IMG_BASE_PATH + "13-background-picker-selection-made.png",
          buttons: sectionButtons 
        },
        {
          title: "黑兔兔兔兔兔",
          subtitle: "焦到變小小一隻",
          image_url: IMG_BASE_PATH + "14-background-changed.png",
          buttons: sectionButtons 
        }
      );
    break; 
  }

  if (templateElements.length < 2) {
    console.error("each template should have at least two elements");
  }
  
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: templateElements
        }
      }
    }
  };

  return messageData;
}

/*
 * This response uses image attachments to illustrate each step of each feature.
 * Since this technique limits the number of buttons you can present to the user 
 * to two, we provide Restart and Continue buttons, forcing the user to consume 
 * this content in a mostly linear order, one piece at a time.
 */
function getImageAttachments(recipientId, helpRequestType) {
  var textToSend = '';
  var quickReplies = [
    {
      "content_type":"text",
      "title":"Restart",
      "payload":"QR_RESTART"
    }, // this option should always be present because it allows the user to start over
    {
      "content_type":"text",
      "title":"Continue",
      "payload":""
    } // the Continue option only makes sense if there is more content to show 
      // remove this option when you are at the end of a branch in the content tree
      // i.e.: when you are showing the last message for the selected feature
  ];
  
  // to send an image attachment in a message, just set the payload property of this attachment object
  // if the payload property is defined, this will be added to the message before it is sent
  var attachment = {
    "type": "image",
    "payload": ""
  };

  switch(helpRequestType) {
    case 'QR_RESTART' :
      sendHelpOptionsAsQuickReplies(recipientId);
      return;
    break;
    
    // the Rotation feature
    case 'QR_ROTATION_1' :
      textToSend = 'Click the Rotate button to toggle the poster\'s orientation between landscape and portrait mode.';
      quickReplies[1].payload = "QR_ROTATION_2";
    break; 
    case 'QR_ROTATION_2' :
      // 1 of 2 (portrait, landscape)
      attachment.payload = {
        url: IMG_BASE_PATH + "01-rotate-landscape.png"
      }
      quickReplies[1].payload = "QR_ROTATION_3";
    break; 
    case 'QR_ROTATION_3' :
      // 2 of 2 (portrait, landscape)
      attachment.payload = {
        url: IMG_BASE_PATH + "02-rotate-portrait.png"
      }
      quickReplies.pop();
      quickReplies[0].title = "Explore another feature";
    break; 
    // the Rotation feature


    // the Photo feature
    case 'QR_PHOTO_1' :
      textToSend = 'Click the Photo button to select an image to use on your poster. We recommend visiting https://unsplash.com/random from your device to seed your Downloads folder with some images before you get started.';
      quickReplies[1].payload = "QR_PHOTO_2";
    break; 
    case 'QR_PHOTO_2' :
      // 1 of 3 (placeholder image, Downloads folder, poster with image)
      attachment.payload = {
        url: IMG_BASE_PATH + "03-photo-hover.png"
      }
      quickReplies[1].payload = "QR_PHOTO_3";
    break; 
    case 'QR_PHOTO_3' :
      // 2 of 3 (placeholder image, Downloads folder, poster with image)
      attachment.payload = {
        url: IMG_BASE_PATH + "04-photo-list.png"
      }
      quickReplies[1].payload = "QR_PHOTO_4";
    break; 
    case 'QR_PHOTO_4' :
      // 3 of 3 (placeholder image, Downloads folder, poster with image)
      attachment.payload = {
        url: IMG_BASE_PATH + "05-photo-selected.png"
      }
      quickReplies.pop();
      quickReplies[0].title = "Explore another feature";
    break; 
    // the Photo feature


    // the Caption feature
    case 'QR_CAPTION_1' :
      textToSend = 'Click the Text button to set the caption that appears at the bottom of the poster.';
      quickReplies[1].payload = "QR_CAPTION_2";
    break; 
    case 'QR_CAPTION_2' :
      // 1 of 4 (hover, entering caption, mid-edit, poster with new caption)
      attachment.payload = {
        url: IMG_BASE_PATH + "06-text-hover.png"
      }
      quickReplies[1].payload = "QR_CAPTION_3";
    break; 
    case 'QR_CAPTION_3' :
      // 2 of 4: (hover, entering caption, mid-edit, poster with new caption
      attachment.payload = {
        url: IMG_BASE_PATH + "07-text-mid-entry.png"
      }
      quickReplies[1].payload = "QR_CAPTION_4";
    break; 
    case 'QR_CAPTION_4' :
      // 3 of 4 (hover, entering caption, mid-edit, poster with new caption)
      attachment.payload = {
        url: IMG_BASE_PATH + "08-text-entry-done.png"
      }
      quickReplies[1].payload = "QR_CAPTION_5";
    break; 
    case 'QR_CAPTION_5' :
      // 4 of 4 (hover, entering caption, mid-edit, poster with new caption)
      attachment.payload = {
        url: IMG_BASE_PATH + "09-text-complete.png"
      }
      quickReplies.pop();
      quickReplies[0].title = "Explore another feature";
    break; 
    // the Caption feature



    // the Color Picker feature
    case 'QR_BACKGROUND_1' :
      textToSend = 'Click the Background button to select a background color for your poster.';
      quickReplies[1].payload = "QR_BACKGROUND_2";
    break; 
    case 'QR_BACKGROUND_2' :
      // 1 of 5 (hover, entering caption, mid-edit, poster with new caption)
      attachment.payload = {
        url: IMG_BASE_PATH + "10-background-picker-hover.png"
      }
      quickReplies[1].payload = "QR_BACKGROUND_3";
    break; 
    case 'QR_BACKGROUND_3' :
      // 2 of 5 (hover, entering caption, mid-edit, poster with new caption)
      attachment.payload = {
        url: IMG_BASE_PATH + "11-background-picker-appears.png"
      }
      quickReplies[1].payload = "QR_BACKGROUND_4";
    break; 
    case 'QR_BACKGROUND_4' :
      // 3 of 5 (hover, entering caption, mid-edit, poster with new caption)
      attachment.payload = {
        url: IMG_BASE_PATH + "12-background-picker-selection.png"
      }
      quickReplies[1].payload = "QR_BACKGROUND_5";
    break; 
    case 'QR_BACKGROUND_5' :
      // 4 of 5 (hover, entering caption, mid-edit, poster with new caption)
      attachment.payload = {
        url: IMG_BASE_PATH + "13-background-picker-selection-made.png"
      }
      quickReplies[1].payload = "QR_BACKGROUND_6";
    break; 
    case 'QR_BACKGROUND_6' :
      // 5 of 5 (hover, entering caption, mid-edit, poster with new caption)
      attachment.payload = {
        url: IMG_BASE_PATH + "14-background-changed.png"
      }
      quickReplies.pop();
      quickReplies[0].title = "Explore another feature";
    break; 
    // the Color Picker feature

    default : 
      sendHelpOptionsAsQuickReplies(recipientId);
      return;

    break;
  }

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: textToSend,
      quick_replies: quickReplies
    },
  };
  if (attachment.payload !== "") {
    messageData.message.attachment = attachment;
    // text can not be specified when you're sending an attachment
    delete messageData.message.text;
  }

  return messageData;
}

/*
 * Start your server
 */
app.listen(app.get('port'), function() {
  console.log('[app.listen] Node app is running on port', app.get('port'));
});

module.exports = app;
