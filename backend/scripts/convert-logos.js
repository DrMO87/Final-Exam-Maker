import fs from 'fs';
import path from 'path';

const userDir = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\545867c8-b4df-49f5-92d5-eed22a9358aa\\.user_uploaded';

const dtuB64 = fs.readFileSync(path.join(userDir, 'media_1786212464315.png')).toString('base64');
const pharmacyB64 = fs.readFileSync(path.join(userDir, 'media_1786212469133.png')).toString('base64');
const hueB64 = fs.readFileSync(path.join(userDir, 'media_1786212475025.png')).toString('base64');

if (!fs.existsSync('frontend/src/assets')) {
  fs.mkdirSync('frontend/src/assets', { recursive: true });
}

const jsContent = `export const LOGO_DTU = "data:image/png;base64,${dtuB64}";
export const LOGO_PHARMACY = "data:image/png;base64,${pharmacyB64}";
export const LOGO_HUE = "data:image/png;base64,${hueB64}";
`;

fs.writeFileSync('frontend/src/assets/logos.js', jsContent);
console.log('Successfully generated frontend/src/assets/logos.js');
