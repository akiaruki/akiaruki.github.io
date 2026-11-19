// Small WebGL2 helper for the full-frame picture shaders (camcorder tape, lens filters, Pro panel).
const VS = `#version 300 es
in vec2 p;out vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const HEAD = `#version 300 es
precision highp float;in vec2 vUv;out vec4 o;uniform sampler2D uTex;uniform vec2 uRes;uniform float uImg;
vec2 cover(vec2 uv){float a=uRes.x/uRes.y;vec2 s=a>uImg?vec2(1.,uImg/a):vec2(a/uImg,1.);return (uv-.5)*s+.5;}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
`;

export function createFX(canvas, frag, maxW = 1100) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, HEAD + frag);
  if (!vs || !fs) return null;
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  const ul = {}; const u = (n) => (n in ul ? ul[n] : (ul[n] = gl.getUniformLocation(prog, n)));
  let imgAspect = 1, lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; canvas.parentElement.classList.remove('live'); });
  const api = {
    get lost() { return lost; },
    setImage(img) {
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      imgAspect = img.naturalWidth / img.naturalHeight;
    },
    resize() {
      const r = canvas.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.min(maxW, Math.round(r.width * d))), h = Math.max(2, Math.round(w * r.height / Math.max(1, r.width)));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    },
    draw(uniforms = {}) {
      if (lost) return;
      api.resize(); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('uRes'), canvas.width, canvas.height); gl.uniform1f(u('uImg'), imgAspect); gl.uniform1i(u('uTex'), 0);
      for (const k in uniforms) { const v = uniforms[k], l = u(k); if (l === null) continue;
        if (typeof v === 'number') gl.uniform1f(l, v); else if (v.length === 2) gl.uniform2f(l, v[0], v[1]); else gl.uniform3f(l, v[0], v[1], v[2]); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
  return api;
}

// Tape picture: line wobble, chroma bleed, head-switching band, a slow tracking roll, dropouts, grain.
export const VHS = `
uniform float uTime,uAmt;
vec3 yiq(vec3 c){return vec3(dot(c,vec3(.299,.587,.114)),dot(c,vec3(.596,-.274,-.322)),dot(c,vec3(.211,-.523,.312)));}
vec3 rgb(vec3 c){return vec3(c.x+.956*c.y+.621*c.z,c.x-.272*c.y-.647*c.z,c.x-1.106*c.y+1.703*c.z);}
void main(){
  vec2 uv=vUv;float t=uTime;float line=floor(uv.y*240.);
  float wob=(hash(vec2(line,floor(t*30.)))-.5)*.0022*uAmt+sin(uv.y*9.+t*1.7)*.0009*uAmt;
  float roll=fract(t*.045);float band=smoothstep(.06,0.,abs(uv.y-(1.-roll)))*uAmt;
  wob+=band*.012*(hash(vec2(line,floor(t*24.)+3.))-.3);
  float head=smoothstep(.045,.0,uv.y)*uAmt;
  wob+=head*(.02+.03*hash(vec2(line,floor(t*18.))));
  vec2 q=cover(vec2(uv.x+wob,uv.y));
  float px=1.5/uRes.x*(1.+uAmt);
  vec3 a=yiq(texture(uTex,q).rgb);
  float Y=(a.x*2.+yiq(texture(uTex,q+vec2(px,0.)).rgb).x+yiq(texture(uTex,q-vec2(px,0.)).rgb).x)*.25;
  vec2 C=vec2(0.);
  for(int i=-3;i<=3;i++){C+=yiq(textureLod(uTex,q+vec2(float(i)*px*1.8+.003*uAmt,0.),1.).rgb).yz;}
  C/=7.;
  vec3 c=rgb(vec3(Y,C*(1.-.12*uAmt)));
  c=mix(c,c*c*(3.-2.*c),.12);
  c=c*(1.-.05*uAmt)+.035*uAmt;
  float n=hash(uv*uRes+fract(t)*91.7)-.5;c+=n*.05*uAmt;
  float drop=step(.9987,hash(vec2(line*.37,floor(t*14.))))*step(hash(vec2(floor(uv.x*26.),line+floor(t*14.))),.35);
  c+=drop*.45*uAmt;
  c+=band*.05+head*.12*hash(vec2(uv.x*80.,line+t));
  c*=.94+.06*sin(uv.y*uRes.y*3.14159*.5);
  vec2 v=uv-.5;c*=1.-dot(v,v)*.45;
  o=vec4(c,1.);
}`;

// Lens filters, drawn from the photograph's own highlights. uS animates 0..1 on each change.
export const LENS = `
uniform float uMode,uS;
vec3 hi(vec2 q,float lod){vec3 c=textureLod(uTex,q,lod).rgb;float l=lum(c);return c*smoothstep(.42,.9,l);}
vec3 pt(vec2 q){vec3 c=textureLod(uTex,q,1.4).rgb;float d=lum(c)-lum(textureLod(uTex,q,4.6).rgb);return c*smoothstep(.36,.62,min(c.r,min(c.g,c.b)))*smoothstep(.05,.2,d);}
vec2 fish(vec2 uv,float k){vec2 p=(uv-.5)*2.;float a=uRes.x/uRes.y;p.x*=a;float rn=length(p)/length(vec2(a,1.));p*=(1.+k*rn*rn)/(1.+k);p.x/=a;return p*.5+.5;}
void main(){
  vec2 uv=vUv;vec2 q=cover(uv);int m=int(uMode+.5);vec3 base=texture(uTex,q).rgb;vec3 c=base;float asp=uRes.x/uRes.y;
  if(m==1){vec3 g=hi(q,3.)*.5+hi(q,4.5)*.7+hi(q,6.)*.9;vec3 soft=textureLod(uTex,q,5.).rgb;c=base*.88+.04+g*1.5+soft*.12;}
  else if(m==2){vec3 s=vec3(0.);for(int i=1;i<=36;i++){float f=float(i)/36.;float w=pow(max(1.-f,0.),2.6);float d=f*.15;
      s+=(pt(q+vec2(d*.5,d*.866*asp))+pt(q-vec2(d*.5,d*.866*asp))+pt(q+vec2(d*.866,-d*.5*asp))+pt(q-vec2(d*.866,-d*.5*asp)))*w;}
    c=base+s*.3+pt(q)*.5;}
  else if(m==3){vec3 b=textureLod(uTex,q,3.6).rgb;c=1.-(1.-base)*(1.-b*.42);c=mix(base,c,.9);}
  else if(m==4){c=base*vec3(1.13,1.,.78);c=mix(c,vec3(lum(c))*vec3(1.1,1.,.82),.06);}
  else if(m==5){c=base*vec3(.8,.97,1.2);}
  else if(m==6){vec3 s=vec3(0.);for(int i=1;i<=44;i++){float f=float(i)/44.;float w=pow(max(1.-f,0.),1.8);float d=f*.36;s+=(pt(q+vec2(d,0.))+pt(q-vec2(d,0.)))*w;}
    c=base+vec3(lum(s))*vec3(.25,.55,1.)*.42+pt(q)*.4;}
  else if(m==7){vec2 p=(uv-.5)*2.;p.x*=asp;float lim=min(asp,1.)*.98;float r=length(p)/lim;
    vec2 f=(p/lim)*(1.+1.5*r*r)/(2.5)*1.02;f*=lim;f.x/=asp;vec2 w=mix(uv,f*.5+.5,uS);
    c=texture(uTex,cover(w)).rgb;float edge=1.-smoothstep(.985,1.,r);c*=mix(1.,edge*(1.-.35*pow(r,6.)),uS);o=vec4(c,1.);return;}
  else if(m==8){vec2 w=mix(uv,fish(uv,.85),uS);c=texture(uTex,cover(w)).rgb;o=vec4(c,1.);return;}
  o=vec4(mix(base,c,uS),1.);
}`;

// Pro panel: exposure, white balance, tint and focus applied to the photograph.
export const PRO = `
uniform float uGain,uBlur;uniform vec3 uWB;
void main(){vec2 q=cover(vUv);vec3 c=textureLod(uTex,q,uBlur).rgb;c=pow(c,vec3(2.2))*uGain*uWB;c=c/(1.+max(c-.8,0.)*.6);o=vec4(pow(clamp(c,0.,1.),vec3(1./2.2)),1.);}`;
