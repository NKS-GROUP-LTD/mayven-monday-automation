const MONDAY_API_TOKEN = Deno.env.get("MONDAY_API_TOKEN") ?? "";
const METADATA_SYNC_URL = "https://syrhxhytlkcnakicnyde.supabase.co/functions/v1/monday-metadata-sync";

function buildHtml(): string {
  const parts: string[] = [];
  parts.push("<!DOCTYPE html>");
  parts.push('<html lang="he" dir="rtl">');
  parts.push("<head>");
  parts.push('<meta charset="UTF-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  parts.push("<title>Monday Metadata Admin</title>");
  parts.push("<style>");
  parts.push("* { box-sizing: border-box; margin: 0; padding: 0; }");
  parts.push("body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #1a1a1a; min-height: 100vh; padding: 2rem 1rem; }");
  parts.push(".container { max-width: 620px; margin: 0 auto; }");
  parts.push("h1 { font-size: 20px; font-weight: 600; margin-bottom: 6px; }");
  parts.push(".subtitle { font-size: 13px; color: #666; margin-bottom: 2rem; }");
  parts.push(".card { background: #fff; border-radius: 12px; border: 1px solid #e5e5e5; padding: 1.5rem; margin-bottom: 1rem; }");
  parts.push("label { display: block; font-size: 12px; color: #666; margin-bottom: 5px; font-weight: 500; }");
  parts.push("input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; background: #fafafa; color: #1a1a1a; outline: none; }");
  parts.push("input:focus { border-color: #6366f1; background: #fff; }");
  parts.push(".field { margin-bottom: 12px; }");
  parts.push(".hint { font-size: 11px; color: #999; margin-top: 4px; }");
  parts.push("button { width: 100%; padding: 10px; border-radius: 8px; border: none; background: #6366f1; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }");
  parts.push("button:hover { background: #4f46e5; }");
  parts.push("button:disabled { background: #c7d2fe; cursor: not-allowed; }");
  parts.push(".log { margin-top: 1rem; background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; max-height: 360px; overflow-y: auto; line-height: 1.8; display: none; }");
  parts.push(".ok { color: #16a34a; } .err { color: #dc2626; } .info { color: #6b7280; }");
  parts.push(".summary { margin-top: 12px; font-size: 13px; padding: 10px 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; display: none; }");
  parts.push(".tab-row { display: flex; gap: 8px; margin-bottom: 1.25rem; }");
  parts.push(".tab { padding: 6px 14px; border-radius: 6px; border: 1px solid #e5e5e5; background: #fafafa; font-size: 13px; cursor: pointer; color: #555; font-weight: 500; }");
  parts.push(".tab.active { background: #6366f1; color: #fff; border-color: #6366f1; }");
  parts.push(".panel { display: none; } .panel.active { display: block; }");
  parts.push("</style></head><body>");
  parts.push('<div class="container">');
  parts.push("<h1>Monday Metadata Admin</h1>");
  parts.push('<p class="subtitle">עדכון Board Name / Group Name / Link to Item</p>');
  parts.push('<div class="card">');
  parts.push('<div class="tab-row">');
  parts.push('<div class="tab active" onclick="switchTab(\'board\')">לפי בורד</div>');
  parts.push('<div class="tab" onclick="switchTab(\'item\')">אייטם ספציפי</div>');
  parts.push("</div>");
  parts.push('<div class="panel active" id="panel-board">');
  parts.push('<div class="field"><label>שם בורד (או חלק ממנו)</label>');
  parts.push('<input type="text" id="boardName" placeholder="לדוגמה: Mini-Cart" />');
  parts.push('<p class="hint">תמצא את הבורד הראשון שמכיל את הטקסט.</p></div>');
  parts.push('<div class="field"><label>שם גרופ (אופציונלי)</label>');
  parts.push('<input type="text" id="groupName" placeholder="אם ריק — כל הבורד" /></div>');
  parts.push('<button onclick="runBoard()" id="btnBoard">הרץ על הבורד</button>');
  parts.push("</div>");
  parts.push('<div class="panel" id="panel-item">');
  parts.push('<div class="field"><label>Board ID</label>');
  parts.push('<input type="text" id="boardId" placeholder="18405194017" /></div>');
  parts.push('<div class="field"><label>Item ID</label>');
  parts.push('<input type="text" id="itemId" placeholder="11579968546" />');
  parts.push('<p class="hint">נמצא ב-URL של האייטם ב-Monday.</p></div>');
  parts.push('<button onclick="runItem()" id="btnItem">עדכן אייטם</button>');
  parts.push("</div></div>");
  parts.push('<div class="log" id="log"></div>');
  parts.push('<div class="summary" id="summary"></div>');
  parts.push("</div>");

  parts.push("<script>");
  parts.push("var SYNC='" + METADATA_SYNC_URL + "';");
  parts.push("var L=document.getElementById('log'),S=document.getElementById('summary');");
  parts.push("function switchTab(t){");
  parts.push("  document.querySelectorAll('.tab').forEach(function(x,i){x.classList.toggle('active',(i===0&&t==='board')||(i===1&&t==='item'));});");
  parts.push("  document.getElementById('panel-board').classList.toggle('active',t==='board');");
  parts.push("  document.getElementById('panel-item').classList.toggle('active',t==='item');");
  parts.push("}");
  parts.push("function line(txt,cls){L.style.display='block';var d=document.createElement('div');d.className=cls||'info';d.textContent=txt;L.appendChild(d);L.scrollTop=L.scrollHeight;}");
  parts.push("function sum(t,o,f){S.style.display='block';S.style.background=f>0?'#fef2f2':'#f0fdf4';S.style.borderColor=f>0?'#fecaca':'#bbf7d0';S.innerHTML='סיכום: <strong>'+t+'</strong> — <span style=\"color:#16a34a\">'+o+' הצליחו</span>'+(f>0?', <span style=\"color:#dc2626\">'+f+' נכשלו</span>':'');}");
  parts.push("async function mq(q){var r=await fetch(location.pathname+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});return (await r.json()).data;}");
  parts.push("async function sync(b,i){var r=await fetch(SYNC+'?board='+b+'&item='+i);return r.json();}");
  parts.push("async function runItem(){");
  parts.push("  var b=document.getElementById('boardId').value.trim(),i=document.getElementById('itemId').value.trim();");
  parts.push("  if(!b||!i){line('חובה להזין Board ID ו-Item ID.','err');return;}");
  parts.push("  L.innerHTML='';L.style.display='block';S.style.display='none';");
  parts.push("  document.getElementById('btnItem').disabled=true;");
  parts.push("  line('מעדכן אייטם '+i+'...','info');");
  parts.push("  try{var j=await sync(b,i);if(j.success||j.result){var r=j.result;line('הצלחה!','ok');if(r){line('Board: '+r.sourceBoardName,'ok');line('Group: '+r.sourceGroupName,'ok');}sum(1,1,0);}else{line('שגיאה: '+(j.error||JSON.stringify(j)),'err');sum(1,0,1);}}catch(e){line(e.message,'err');sum(1,0,1);}");
  parts.push("  document.getElementById('btnItem').disabled=false;");
  parts.push("}");
  parts.push("async function runBoard(){");
  parts.push("  var bn=document.getElementById('boardName').value.trim(),gn=document.getElementById('groupName').value.trim();");
  parts.push("  if(!bn){line('חובה להזין שם בורד.','err');return;}");
  parts.push("  L.innerHTML='';L.style.display='block';S.style.display='none';");
  parts.push("  document.getElementById('btnBoard').disabled=true;");
  parts.push("  line('מחפש בורד...','info');");
  parts.push("  var boards=[],p=1;");
  parts.push("  while(p<=20){var d=await mq('query{boards(limit:50,page:'+p+'){id name}}');var b=(d&&d.boards)?d.boards:[];boards=boards.concat(b);if(b.length<50)break;p++;}");
  parts.push("  var s=bn.replace(/^.\\s*/,'').toLowerCase();");
  parts.push("  var found=boards.filter(function(x){return x.name.replace(/^.\\s*/,'').toLowerCase().indexOf(s)>=0;});");
  parts.push("  if(!found.length){line('לא נמצא בורד: '+bn,'err');document.getElementById('btnBoard').disabled=false;return;}");
  parts.push("  var board=found[0];line('נמצא: '+board.name+' ('+board.id+')','ok');");
  parts.push("  var gd=await mq('query{boards(ids:['+board.id+']){groups{id title}}}');");
  parts.push("  var ag=(gd&&gd.boards&&gd.boards[0])?gd.boards[0].groups:[];");
  parts.push("  var groups=ag;");
  parts.push("  if(gn){var gs=gn.toLowerCase();groups=ag.filter(function(g){return g.title.toLowerCase().indexOf(gs)>=0;});if(!groups.length){line('לא נמצא גרופ: '+gn,'err');document.getElementById('btnBoard').disabled=false;return;}line('גרופ: '+groups.map(function(g){return g.title;}).join(', '),'ok');}");
  parts.push("  else{line('מריץ על '+ag.length+' גרופים...','info');}");
  parts.push("  var total=0,ok=0,fail=0;");
  parts.push("  for(var gi=0;gi<groups.length;gi++){");
  parts.push("    var g=groups[gi];line('→ '+g.title,'info');");
  parts.push("    var cur=null;");
  parts.push("    while(true){");
  parts.push("      var cp=cur?',cursor:\"'+cur+'\"':'';");
  parts.push("      var pd=await mq('query{boards(ids:['+board.id+']){items_page(limit:50'+cp+',query_params:{rules:[{column_id:\"group\",compare_value:[\"'+g.id+'\"]}]}){cursor items{id}}}}');");
  parts.push("      var pg=(pd&&pd.boards&&pd.boards[0])?pd.boards[0].items_page:null;");
  parts.push("      var items=(pg&&pg.items)?pg.items:[];cur=(pg&&pg.cursor)?pg.cursor:null;");
  parts.push("      for(var ii=0;ii<items.length;ii++){total++;var item=items[ii];");
  parts.push("        try{var j=await sync(board.id,item.id);if(j.success||j.result){ok++;line('  '+item.id+(j.result&&j.result.sourceBoardName?' → '+j.result.sourceBoardName:''),'ok');}else{fail++;line('  FAIL '+item.id,'err');}}catch(e){fail++;line('  ERR '+item.id,'err');}");
  parts.push("        await new Promise(function(r){setTimeout(r,120);});");
  parts.push("      }");
  parts.push("      if(!cur||!items.length)break;");
  parts.push("    }");
  parts.push("  }");
  parts.push("  sum(total,ok,fail);document.getElementById('btnBoard').disabled=false;");
  parts.push("}");
  parts.push("</script></body></html>");
  return parts.join("\n");
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname.includes("/api") && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const res = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": MONDAY_API_TOKEN,
        "API-Version": "2025-01",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response(buildHtml(), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
});
