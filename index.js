const express = require('express');
const cors = require('cors');
const textToSpeech = require('@google-cloud/text-to-speech');
const stream = require('stream');

require('dotenv').config();




// Decode the base64 string from the environment variable
const serviceAccountJson = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString('utf-8');

// Parse the JSON string into an object
const credentials = JSON.parse(serviceAccountJson);

// Initialize the Text-to-Speech client with the credentials object
const ttsClient = new textToSpeech.TextToSpeechClient({ credentials });

const app = express();
const port = 8081;

app.use(cors());
app.use(express.json());

app.post('/synthesize', async (req, res) => {
  try {
    const { text, audioConfig } = req.body;

    if (!text || !audioConfig || !audioConfig.languageCode) {
      return res.status(400).send('Text, audioConfig, and languageCode are required fields.');
    }

    const request = {
      input: { text },
      voice: {
        languageCode: audioConfig.languageCode,
        ssmlGender: audioConfig.gender || 'NEUTRAL',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: audioConfig.pitch || 0,
        speakingRate: audioConfig.speakingRate || 1.0,
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);

    const bufferStream = new stream.PassThrough();
    bufferStream.end(response.audioContent);

    res.set({
      'Content-Type': 'audio/mp3',
      'Transfer-Encoding': 'chunked',
    });

    bufferStream.pipe(res);

  } catch (err) {
    console.error('ERROR:', err);
    res.status(500).send('Something went wrong!');
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
