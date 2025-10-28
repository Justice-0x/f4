
async function readFileAsText(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsText(file);});}
async function parseCSVText(text){return new Promise((res,rej)=>{Papa.parse(text,{header:true,skipEmptyLines:true,complete:(r)=>res(r.data),error:rej});});}
async function ingestFiles(fileList,onProgress){
  const datasets=[];
  for(let i=0;i<fileList.length;i++){
    const f=fileList[i]; if(onProgress) onProgress(i+1,fileList.length,f.name);
    if(f.name.toLowerCase().endsWith(".zip")){
      const buf=await f.arrayBuffer(); const zip=await JSZip.loadAsync(buf);
      const entries=Object.values(zip.files).filter(z=>!z.dir && z.name.toLowerCase().match(/\.(csv|json)$/));
      for(const e of entries){
        const text=await e.async("string");
        if(e.name.toLowerCase().endsWith(".csv")){ datasets.push({name:f.name+"::"+e.name, rows: await parseCSVText(text)}); }
        else if(e.name.toLowerCase().endsWith(".json")){ try{const obj=JSON.parse(text); datasets.push({name:f.name+"::"+e.name, rows:Array.isArray(obj)?obj:[obj]});}catch(_){ } }
      }
    }else if(f.name.toLowerCase().endsWith(".csv")){
      const text=await readFileAsText(f); datasets.push({name:f.name, rows: await parseCSVText(text)});
    }
  }
  return datasets;
}
function normalizeRow(row){
  const map={"I-9 Operation/Stop":"Operation_Stop","I-9_Thermostat_ON":"Thermostat_ON","I-9_Error_code":"Error_code","I-9_Error_subcode":"Error_subcode",
             "Set_temp":"Setpoint_F","I-9_Suction.temp.":"Suction_temp_F","I-9_Indoor_liquid_pipe.temp.":"Liquid_pipe_temp_F","I-9_Indoor_gas_pipe.temp.":"Gas_pipe_temp_F",
             "I-9_Air_thermistor_BRC1":"Air_temp_F","Comp_freq":"Compressor_Hz","Time":"Time","time":"Time"};
  const out={}; for(const k in row){out[map[k]||k]=row[k]}
  ["Setpoint_F","Suction_temp_F","Liquid_pipe_temp_F","Gas_pipe_temp_F","Air_temp_F","Compressor_Hz"].forEach(k=>{const n=Number(out[k]); if(Number.isFinite(n)) out[k]=n;});
  return out;
}
function analyze(datasets){
  const all=[]; for(const ds of datasets){ for(const r of ds.rows){ const row=normalizeRow(r); row.__source=ds.name; all.push(row);} }
  const events=all.filter(r=> (""+(r.Error_code||"")).toUpperCase().includes("F4"));
  const f4BySource={}; for(const e of events){ const key=e.__source.split("::")[0]; f4BySource[key]=(f4BySource[key]||0)+1; }
  const temps=all.filter(r=>typeof r.Suction_temp_F==="number" && typeof r.Liquid_pipe_temp_F==="number");
  const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
  const stats={points:all.length,f4Events:events.length,avgSuction:avg(temps.map(r=>r.Suction_temp_F)),avgLiquid:avg(temps.map(r=>r.Liquid_pipe_temp_F))};
  return {all,events,stats,f4BySource};
}
function drawCharts(data){
  const times=data.all.map((r,i)=>r.Time||i);
  const suction=data.all.map(r=>typeof r.Suction_temp_F==="number"?r.Suction_temp_F:null);
  const liquid=data.all.map(r=>typeof r.Liquid_pipe_temp_F==="number"?r.Liquid_pipe_temp_F:null);
  Plotly.newPlot("chart-temps",[
    {x:times,y:suction,name:"Suction °F",mode:"lines",line:{shape:"hv"}},
    {x:times,y:liquid,name:"Liquid °F",mode:"lines",line:{shape:"hv"}}
  ],{title:"Suction vs Liquid",paper_bgcolor:"#0f1a2e",plot_bgcolor:"#0f1a2e",font:{color:"#cfe5ff"},xaxis:{gridcolor:"#203656"},yaxis:{gridcolor:"#203656"}});
}
function renderKpis(stats){
  const el=document.getElementById("kpis");
  el.innerHTML=`
    <div class="kpi"><div>Data Points</div><b>${stats.points||0}</b></div>
    <div class="kpi"><div>F4 Events</div><b style="color:${stats.f4Events>0?'var(--bad)':'var(--good)'}">${stats.f4Events||0}</b></div>
    <div class="kpi"><div>Avg Suction °F</div><b>${stats.avgSuction?stats.avgSuction.toFixed(1):"—"}</b></div>
    <div class="kpi"><div>Avg Liquid °F</div><b>${stats.avgLiquid?stats.avgLiquid.toFixed(1):"—"}</b></div>`;
}
function renderF4Table(data){
  const tbody=document.getElementById("f4-body");
  const items=Object.entries(data.f4BySource).sort((a,b)=>b[1]-a[1]);
  tbody.innerHTML= items.map(([src,count])=>`<tr><td>${src}</td><td>${count}</td></tr>`).join("") || "<tr><td colspan='2'>No F4 detected</td></tr>";
}
