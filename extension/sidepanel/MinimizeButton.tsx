export function MinimizeButton({disabled,onClick}:{disabled?:boolean;onClick:()=>void}){
 return <button type="button" className="dx-minimize" aria-label="Minimize Wandel panel" title="Minimize to floating control" disabled={disabled} onClick={onClick}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 11.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg></button>;
}
