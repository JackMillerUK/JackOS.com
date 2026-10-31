/* Coalesce trackpad input without building a delayed HTTP command backlog. */
((root) => {
  const clamp=(value,max)=>Math.max(-max,Math.min(max,value));
  function normalize(event,height=600){
    const scale=event.deltaMode===1?16:event.deltaMode===2?height:1;
    return {x:Number(event.deltaX||0)*scale,y:Number(event.deltaY||0)*scale};
  }
  function create({dispatch,height=()=>600,onError=()=>{},schedule=requestAnimationFrame,cancel=cancelAnimationFrame}){
    let x=0,y=0,point={},busy=false,frame=null,stopped=false;
    function enqueue(event,position){
      if(stopped)return;const delta=normalize(event,height());
      if(x*delta.x<0)x=0;if(y*delta.y<0)y=0;
      const max=Math.max(400,height()*2);x=clamp(x+delta.x,max);y=clamp(y+delta.y,max);point=position;
      queue();
    }
    function queue(){if(!busy&&frame===null&&(x||y)&&!stopped)frame=schedule(flush);}
    function flush(){
      frame=null;if(stopped||busy||(!x&&!y))return;
      const dx=clamp(x,400),dy=clamp(y,400);x-=dx;y-=dy;busy=true;
      Promise.resolve().then(()=>dispatch({...point,type:'mouseWheel',deltaX:dx,deltaY:dy}))
        .catch(error=>{x=0;y=0;onError(error);}).finally(()=>{busy=false;queue();});
    }
    return {enqueue,reset(){x=0;y=0;if(frame!==null){cancel(frame);frame=null;}},stop(){stopped=true;this.reset();}};
  }
  root.JackOSWheel={normalize,create};
})(typeof window==='undefined'?globalThis:window);
