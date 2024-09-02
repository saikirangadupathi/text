const express = require('express');
const cors = require('cors');
const textToSpeech = require('@google-cloud/text-to-speech');
const { Translate } = require('@google-cloud/translate').v2;
const stream = require('stream');
require('dotenv').config();

// Decode the base64 string from the environment variable
const serviceAccountJson = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString('utf-8');

// Parse the JSON string into an object
const credentials = JSON.parse(serviceAccountJson);

// Initialize the Text-to-Speech and Translate clients with the credentials object
const ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
const translateClient = new Translate({ credentials });

const app = express();
const port = 8081;

app.use(cors());
app.use(express.json());

async function translateText(text, targetLanguage) {
  try {
    const [translation] = await translateClient.translate(text, targetLanguage);
    return translation;
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Translation failed.');
  }
}

// Endpoint to get live audio stream
app.post('/synthesize', async (req, res) => {
  try {
    const { text, audioConfig } = req.body;

    if (!text || !audioConfig || !audioConfig.languageCode) {
      return res.status(400).send('Text, audioConfig, and languageCode are required fields.');
    }

    // Translate the text if the target language is not English
    let finalText = text;
    if (audioConfig.languageCode !== 'en') {
      finalText = await translateText(text, audioConfig.languageCode);
    }

    // Construct the SSML request with translated text (if applicable)
    const request = {
      input: { text: finalText },
      voice: {
        languageCode: audioConfig.languageCode, // Use the provided language
        ssmlGender: audioConfig.gender || 'NEUTRAL', // Use the provided gender or default to 'NEUTRAL'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: audioConfig.pitch || 0, // Ensure pitch is provided, default to 0 if not
        speakingRate: audioConfig.speakingRate || 1.0, // Ensure speakingRate is provided, default to 1.0 if not
      },
    };

    // Performs the text-to-speech request
    const [response] = await ttsClient.synthesizeSpeech(request);

    // Convert the binary audio content into a stream
    const bufferStream = new stream.PassThrough();
    bufferStream.end(response.audioContent);

    // Set the headers for the response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
    });

    // Pipe the audio content to the response
    bufferStream.pipe(res);

  } catch (err) {
    console.error('ERROR:', err);
    res.status(500).send('Something went wrong!');
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
