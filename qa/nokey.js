// 界面上不许出现任何看起来像凭证的串：真的会被人当真拿去用
const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');
const PAT=[[/sk-[A-Za-z0-9]{16,}/,'OpenAI 风格密钥'],
           [/\b[a-z]{2,6}_live_[A-Za-z0-9]{16,}/,'xx_live_ 风格密钥'],
           [/\bAKIA[0-9A-Z]{12,}/,'AWS Access Key'],
           [/\bghp_[A-Za-z0-9]{20,}/,'GitHub token'],
           [/-----BEGIN [A-Z ]*PRIVATE KEY-----/,'私钥']];
let bad=0;
PAT.forEach(([re,n])=>{const m=h.match(re);
  if(m){bad++;console.log('✗ 出现'+n+'：'+m[0].slice(0,24)+'…')}});
console.log(bad?'':'✅ 没有任何凭证样式的字符串');
process.exit(bad?1:0);
