const fs = require('fs');
const readline = require('readline');

async function searchTranscript() {
  const fileStream = fs.createReadStream('C:\\Users\\rafar\\.gemini\\antigravity\\brain\\d7e6baa9-f8da-454c-9887-dd819b696264\\.system_generated\\logs\\transcript_full.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.includes('USER_INPUT') || line.includes('<USER_REQUEST>')) {
      if (line.includes('Senin') || line.includes('Selasa') || line.includes('Roster') || line.includes('roster') || line.includes('Sapa Pagi')) {
        console.log(`Match on line ${lineCount}`);
        const data = JSON.parse(line);
        console.log('Snippet:', (data.content || '').substring(0, 300));
      }
    }
  }
}

searchTranscript().catch(console.error);
