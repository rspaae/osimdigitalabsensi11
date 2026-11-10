const fs = require('fs');
const readline = require('readline');

async function findPrompt() {
  const fileStream = fs.createReadStream('C:\\Users\\rafar\\.gemini\\antigravity\\brain\\d7e6baa9-f8da-454c-9887-dd819b696264\\.system_generated\\logs\\transcript_full.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1700) {
      const data = JSON.parse(line);
      fs.writeFileSync('scripts/m15-prompt.txt', data.content, 'utf8');
      console.log('Saved line 1700 to scripts/m15-prompt.txt, length:', data.content?.length);
      break;
    }
  }
}

findPrompt().catch(console.error);
