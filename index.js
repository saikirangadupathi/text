const express = require('express');
const cors = require('cors');
const textToSpeech = require('@google-cloud/text-to-speech');
const { Translate } = require('@google-cloud/translate').v2;
const stream = require('stream');

// Load the JSON key file for authentication
const keyFilename = './google_Auth.json'; // Update with the path to your JSON key file
const ttsClient = new textToSpeech.TextToSpeechClient({ keyFilename });
const translateClient = new Translate({ keyFilename });

const app = express();
const port = 8081;

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // for parsing application/json

// Function to translate text using Google Cloud Translation API
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
        pitch: audioConfig.pitch,
        speakingRate: audioConfig.speakingRate,
      },
    };

    // Performs the text-to-speech request
    const [response] = await ttsClient.synthesizeSpeech(request);

    // Convert the binary audio content into a stream
    const bufferStream = new stream.PassThrough();
    bufferStream.end(response.audioContent);

    // Set the headers for the response
    res.set({
      'Content-Type': 'audio/mp3',
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
