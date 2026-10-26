const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const feedbackDir = 'C:\\Users\\Ashutosh Pandey\\.gemini\\antigravity-ide\\brain\\bb9452e2-de4d-4e6e-95e2-8bc06aa3adc0\\.system_generated\\click_feedback';
const outputDir = path.resolve(__dirname);
const concatFile = path.join(outputDir, 'ffmpeg_concat.txt');
const outputFile = path.join(outputDir, 'PAYFLOW_PRODUCT_DEMO.mp4');

const scenes = [
  // Scene 1: Introduction (0:00 - 0:45)
  { file: 'click_feedback_1792570074965.png', duration: 15 },
  { file: 'click_feedback_1792570084018.png', duration: 15 },
  { file: 'click_feedback_1792570092565.png', duration: 15 },

  // Scene 2: Login and Dashboard (0:45 - 1:15)
  { file: 'click_feedback_1792570148502.png', duration: 10 },
  { file: 'click_feedback_1792570182112.png', duration: 20 },

  // Scene 3: Employee Management (1:15 - 1:45)
  { file: 'click_feedback_1792570191982.png', duration: 15 },
  { file: 'click_feedback_1792570203895.png', duration: 15 },

  // Scene 4: Salary Components and CTC (1:45 - 2:45)
  { file: 'click_feedback_1792570230121.png', duration: 15 },
  { file: 'click_feedback_1792570239815.png', duration: 15 },
  { file: 'click_feedback_1792570251522.png', duration: 15 },
  { file: 'click_feedback_1792570262285.png', duration: 15 },

  // Scene 5: Payroll Processing (2:45 - 3:45)
  { file: 'click_feedback_1792570282175.png', duration: 30 },
  { file: 'click_feedback_1792570293712.png', duration: 30 },

  // Scene 6: Attendance, Leave and Reports (3:45 - 4:30)
  { file: 'click_feedback_1792570324808.png', duration: 15 },
  { file: 'click_feedback_1792570336415.png', duration: 15 },
  { file: 'click_feedback_1792570349693.png', duration: 15 },

  // Scene 7: Actual QA Demonstration (4:30 - 5:30)
  { file: 'click_feedback_1792570092565.png', duration: 15 },
  { file: 'click_feedback_1792570119805.png', duration: 15 },
  { file: 'click_feedback_1792570374287.png', duration: 15 },
  { file: 'click_feedback_1792570384776.png', duration: 15 },

  // Scene 8: Conclusion (5:30 - 6:00)
  { file: 'click_feedback_1792570182112.png', duration: 30 },
];

let concatContent = '';
let totalDuration = 0;

for (let i = 0; i < scenes.length; i++) {
  const item = scenes[i];
  const fullPath = path.join(feedbackDir, item.file).replace(/\\/g, '/');
  concatContent += `file '${fullPath}'\n`;
  concatContent += `duration ${item.duration}\n`;
  totalDuration += item.duration;
}

// In concat demuxer, repeat the last file entry without duration
const lastItem = scenes[scenes.length - 1];
const lastFullPath = path.join(feedbackDir, lastItem.file).replace(/\\/g, '/');
concatContent += `file '${lastFullPath}'\n`;

fs.writeFileSync(concatFile, concatContent);
console.log(`Wrote concat list to ${concatFile}. Total duration: ${totalDuration}s (exactly ${Math.floor(totalDuration / 60)}:${String(totalDuration % 60).padStart(2, '0')})`);

const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -vf "fps=25,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p" -c:v libx264 -preset medium -crf 20 -movflags +faststart "${outputFile}"`;

console.log('Running FFmpeg encoding...');
execSync(ffmpegCmd, { stdio: 'inherit' });
console.log(`✓ Successfully rendered demo video: ${outputFile}`);
