const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const feedbackDir = 'C:\\Users\\Ashutosh Pandey\\.gemini\\antigravity-ide\\brain\\bb9452e2-de4d-4e6e-95e2-8bc06aa3adc0\\.system_generated\\click_feedback';
const demoDir = path.resolve(__dirname);
const concatFile = path.join(demoDir, 'final_ffmpeg_concat.txt');
const outputFile = path.join(demoDir, 'PAYFLOW_FINAL_PRESENTATION.mp4');

const scenes = [
  // Scene 1: Introduction & Perimeter (0:00 – 0:45)
  { file: path.join(demoDir, 'clean_login_1.png'), duration: 15 },
  { file: path.join(demoDir, 'clean_login_2.png'), duration: 15 },
  { file: path.join(demoDir, 'clean_login_invalid.png'), duration: 15 },

  // Scene 2: Login and Dashboard (0:45 – 1:15)
  { file: path.join(demoDir, 'clean_login_submit.png'), duration: 10 },
  { file: path.join(feedbackDir, 'click_feedback_1792570182112.png'), duration: 20 },

  // Scene 3: Employee Management (1:15 – 1:45)
  { file: path.join(demoDir, 'clean_employee_search.png'), duration: 15 },
  { file: path.join(feedbackDir, 'click_feedback_1792570203895.png'), duration: 15 },

  // Scene 4: Compensation & Mathematical CTC Engine (1:45 – 2:45)
  { file: path.join(feedbackDir, 'click_feedback_1792570230121.png'), duration: 15 },
  { file: path.join(demoDir, 'clean_templates_tab.png'), duration: 15 },
  { file: path.join(feedbackDir, 'click_feedback_1792570239815.png'), duration: 15 },
  { file: path.join(feedbackDir, 'click_feedback_1792570262285.png'), duration: 15 },

  // Scene 5: Corporate Payroll Operations (2:45 – 3:45)
  { file: path.join(feedbackDir, 'click_feedback_1792570282175.png'), duration: 30 },
  { file: path.join(feedbackDir, 'click_feedback_1792570293712.png'), duration: 30 },

  // Scene 6: Attendance, Leave & Compliance Reports (3:45 – 4:30)
  { file: path.join(feedbackDir, 'click_feedback_1792570324808.png'), duration: 15 },
  { file: path.join(feedbackDir, 'click_feedback_1792570336415.png'), duration: 15 },
  { file: path.join(feedbackDir, 'click_feedback_1792570349693.png'), duration: 15 },

  // Scene 7: Actual QA Demonstration (4:30 – 5:30)
  { file: path.join(demoDir, 'clean_login_invalid.png'), duration: 15 },
  { file: path.join(demoDir, 'clean_login_submit.png'), duration: 15 },
  { file: path.join(feedbackDir, 'click_feedback_1792570374287.png'), duration: 15 },
  { file: path.join(feedbackDir, 'click_feedback_1792570384776.png'), duration: 15 },

  // Scene 8: Final Presentation Closing Card (5:30 – 6:15)
  { file: path.join(demoDir, 'closing_slide.png'), duration: 45 }
];

let concatContent = '';
let totalDuration = 0;

for (let i = 0; i < scenes.length; i++) {
  const item = scenes[i];
  const fullPath = item.file.replace(/\\/g, '/');
  concatContent += `file '${fullPath}'\n`;
  concatContent += `duration ${item.duration}\n`;
  totalDuration += item.duration;
}

// In concat demuxer, repeat the last file entry without duration
const lastItem = scenes[scenes.length - 1];
const lastFullPath = lastItem.file.replace(/\\/g, '/');
concatContent += `file '${lastFullPath}'\n`;

fs.writeFileSync(concatFile, concatContent);
console.log(`Wrote concat list to ${concatFile}. Total duration: ${totalDuration}s (${Math.floor(totalDuration / 60)}:${String(totalDuration % 60).padStart(2, '0')})`);

const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -vf "fps=25,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p" -c:v libx264 -preset medium -crf 20 -movflags +faststart "${outputFile}"`;

console.log('Running FFmpeg encoding for PAYFLOW_FINAL_PRESENTATION.mp4...');
execSync(ffmpegCmd, { stdio: 'inherit' });
console.log(`✓ Successfully rendered final presentation video: ${outputFile}`);
