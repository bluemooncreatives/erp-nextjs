import ts from 'typescript';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.tsx')?[path.join(dir,e.name)]:[])}
const changes=[];
for(const file of files('app/(dashboard)')) {
 let code=readFileSync(file,'utf8');
 const source=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const edits=[];
 function visit(node){
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='Link'){
   const opening=node.openingElement;
   const attr=opening.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(source)==='className'&&a.initializer&&ts.isStringLiteral(a.initializer));
   const value=attr?.initializer?.text;
   if(value&&/rounded/.test(value)&&/px-/.test(value)&&(/bg-primary/.test(value)||(/border/.test(value)&&/py-/.test(value)))){
    edits.push([opening.tagName.getStart(source),opening.tagName.end,'LinkButton'],[node.closingElement.tagName.getStart(source),node.closingElement.tagName.end,'LinkButton']);
    edits.push([attr.getStart(source),attr.end,/bg-primary/.test(value)?'':'variant="outline"']);
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
 if(!edits.length)continue;
 for(const [start,end,value] of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,start)+value+code.slice(end);
 const imp="import { LinkButton } from '@/components/common/link-button';\n";
 const match=code.match(/^(['"]use client['"];?\s*)/);
 code=match?code.slice(0,match[0].length)+imp+code.slice(match[0].length):imp+code;
 if(!/<Link\b/.test(code))code=code.replace(/import Link from ['"]next\/link['"];?\r?\n/,'');
 writeFileSync(file,code);
 changes.push({file,links:edits.length/3});
}
console.log(JSON.stringify(changes));
