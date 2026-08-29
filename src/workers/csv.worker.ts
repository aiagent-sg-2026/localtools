import Papa from 'papaparse';
export type CsvRequest={type:'parse';text:string};
export type CsvResponse={type:'progress';percent:number}|{type:'done';rows:string[][]}|{type:'error';message:string};
self.onmessage=(event:MessageEvent<CsvRequest>)=>{try{const result=Papa.parse<string[]>(event.data.text,{skipEmptyLines:true,dynamicTyping:false});if(result.errors.length)throw Error(`CSV parse error on row ${result.errors[0].row+1}: ${result.errors[0].message}`);self.postMessage({type:'done',rows:result.data} satisfies CsvResponse);}catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:'Could not parse this CSV.'} satisfies CsvResponse);}};
