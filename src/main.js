import "./styles/main.css";
import {C,PAGES,LOGO} from "./content.js";

const $=s=>document.querySelector(s);
const ph=(k,i=0,cls="",lab="")=>{const u=C.images[k];return `<div class="ph ${u?"img":"sil"} rv ${cls}" style="--h:${(i*47+28)%360};${u?`background-image:url('${u}')`:""}" data-l="${lab||"Image placeholder"}" role="img" aria-label="${lab||"Placeholder image"}"></div>`};
const head=(e,t,l="")=>`<span class="eye rv">${e}</span><h2 class="rv">${t}</h2>${l?`<p class="lead rv" style="margin-top:20px">${l}</p>`:""}`;
const grid=(arr,key)=>`<div class="mos mos-${key}">${arr.map((d,i)=>{const vid=d[3]?C.videos[d[3]]:"";const poster=d[2]?C.images[d[2]]:"";if(vid){return `<div class="t rv vid-tile" data-t="${d[0]}" data-i="${i}" data-k="${d[2]||""}" aria-label="${d[0]}"><video class="tile-video" preload="metadata" playsinline muted loop ${poster?`poster="${poster}"`:""} data-src="${vid}"></video><button type="button" class="play" aria-label="Play video">▶</button><div class="cap"><small>${d[1]}</small>${d[0]}</div></div>`}return `<button class="t rv" data-t="${d[0]}" data-i="${i}" data-k="${d[2]||""}" aria-label="View ${d[0]}">${ph(d[2]||key,i+(key=="s"?5:0),"",d[2]?d[0]:d[1])}<div class="cap"><small>${d[1]}</small>${d[0]}</div></button>`}).join("")}</div>`;
const cta=()=>`<section class="sec dark"><div class="w" style="text-align:center"><span class="eye rv">Admissions</span><h2 class="rv">Begin your <em style="color:var(--gold)">creative journey</em></h2><p class="lead rv" style="margin:22px auto 0">Call us to ask about fees and how to apply.</p><div class="row rv" style="justify-content:center"><a class="btn g" href="#admissions">Apply Now</a><a class="btn" style="border-color:var(--invt);color:var(--invt)" href="#contact">Ask a Question</a></div></div></section>`;
const note=(t)=>`<div class="note">${t}</div>`;
const VALUES=[
{n:"01",t:"Our Philosophy",h:"Timeless Elegance. Individual Expression. Exceptional Craftsmanship.",p:["At Jokel Fashion World, we believe fashion is an art form through which individuality, culture and creativity find expression.","Our philosophy is rooted in the belief that beautiful fashion goes beyond trends. It is about creating pieces that carry meaning, celebrate personal identity and stand the test of time.","Inspired by the richness of Ghanaian culture and the evolving world of fashion, we embrace creativity, thoughtful design and attention to detail in everything we do.","Whether creating a bespoke outfit or nurturing an aspiring designer, we believe that excellence begins with passion and is brought to life through craftsmanship."]},
{n:"02",t:"Our Mission",h:"Creating with Purpose. Inspiring Through Fashion.",p:["Our mission is to celebrate the art of fashion through exceptional design, quality craftsmanship and the development of creative talent.","As a fashion house, we are committed to creating distinctive bespoke and ready-to-wear pieces that reflect individuality, elegance and thoughtful design.","As a fashion academy, we seek to nurture aspiring designers by encouraging creativity, developing practical skills and cultivating an appreciation for the discipline behind fashion creation.","Through both our creations and our educational commitment, we aim to contribute positively to the evolving fashion industry."]},
{n:"03",t:"Our Vision",h:"Preserving Creativity. Shaping the Future of Fashion.",p:["Our vision is to establish Jokel Fashion World as a recognised name in fashion design and education, celebrated for its creativity, craftsmanship and contribution to the development of emerging talent.","We aspire to create a lasting presence in the fashion industry by celebrating individuality, drawing inspiration from our cultural heritage and embracing new possibilities in contemporary fashion.","We envision a future where our designs inspire confidence, our craftsmanship earns appreciation and the creative talents nurtured within our academy make meaningful contributions to the world of fashion."]},
{n:"04",t:"Our Approach to Education",h:"Beyond Learning. Towards Creative Excellence.",p:["At Jokel Fashion World, we believe fashion education should empower individuals to transform creative ideas into practical expressions of art.","We value the importance of developing practical abilities, understanding the fundamentals of garment creation and encouraging students to explore their own creative identities.","Our approach is centred on the relationship between creativity and technical skill. We believe aspiring designers should appreciate not only the beauty of a finished garment but also the knowledge, patience and dedication required to create it.","Our goal is to encourage a learning environment where creativity is explored, skills are developed and confidence is built through the journey of fashion design."]},
{n:"05",t:"Our Approach to Craftsmanship",h:"Every Stitch Matters. Every Creation Tells a Story.",p:["We believe exceptional fashion is found in the details.","At Jokel Fashion World, craftsmanship is an essential part of our creative identity. From the selection of fabrics to design development, garment construction and final finishing, we appreciate the care and precision that go into creating a beautiful piece.","Our work celebrates the balance between traditional inspiration and contemporary design, bringing together cultural influences, modern trends and individual expression.","We value quality, attention to detail and the dedication required to turn an idea into a finished creation.","For us, a garment is more than fabric brought together. It is an expression of creativity, skill and the passion behind its making."]}
];
const R={
home:()=>`<section class="hero">${ph("hero",2,"","Ruffle-shoulder red gown by Jokel Fashion World")}<div class="w"><span class="eye">Fashion House & Academy</span>
<h1><span class="ln"><span>Where Creativity</span></span><span class="ln"><span>Meets Craftsmanship</span></span></h1>
<p style="margin-top:28px">Jokel Fashion World is a fashion house and a fashion academy — designing garments and developing the next generation of creative talent.</p>
<div class="row"><a class="btn g" href="#academy">Explore the Fashion School</a><a class="btn" href="#designs">Discover Our Designs</a><a class="btn" href="#admissions">Apply Now</a></div></div><div class="scr">Scroll</div></section>
<section class="sec"><div class="w two"><div>${head("The House","Design and education, <em>under one roof</em>","Jokel Fashion World brings together two complementary worlds: professional fashion design and the development of emerging creative talent.")}<div class="row rv"><a class="btn" href="#about">Our Story</a></div></div>${ph("intro",1,"","Beaded red lace gown by Jokel Fashion World")}</div></section>
<section class="sec alt"><div class="w">${head("The Academy","Learn the craft","A 6-month beginner course: from first stitch to a complete outfit.")}
<div class="lst">${C.curriculum.map((c,i)=>`<div class="rv"><span class="n">0${i+1}</span><span style="font-family:var(--serif);font-size:1.7rem">${c[0]}</span><span class="tag">Month ${i+1}</span></div>`).join("")}</div>
<div class="row rv"><a class="btn" href="#programmes">View Programmes</a></div></div></section>
<section class="sec"><div class="w">${head("Fashion House","Collections & couture")}${grid(C.designs.slice(0,5),"d")}<div class="row rv"><a class="btn" href="#designs">Full Portfolio</a></div></div></section>
<section class="sec alt"><div class="w">${head("Student Creativity","Work from the studio")}${grid(C.students.slice(0,5),"s")}</div></section>
<section class="sec"><div class="w">${head("Recognition","Achievements","Verified entries will appear here.")}<div class="lst">${C.achievements.slice(0,2).map(a=>`<div class="rv"><span class="n">${a[0]}</span><span>${a[1]}${a[3]?`<a class="lnk" href="${a[3]}" target="_blank" rel="noopener">Read the feature ↗</a>`:""}</span><span class="tag">${a[2]}</span></div>`).join("")}</div></div></section>${cta()}`,
about:()=>`<section class="sec about-hero" style="padding-top:170px"><div class="w about-story"><div class="about-story-copy"><span class="eye rv">Our Story</span><h1 class="rv about-title">The Art of Fashion. <em>The Power of Creativity.</em></h1><p class="lead rv about-intro">At Jokel Fashion World, fashion is more than what we wear. It is an expression of identity, creativity and craftsmanship.</p><div class="about-prose rv"><p>Built around a passion for fashion design and the art of creating beautiful garments, Jokel Fashion World brings together two complementary worlds: professional fashion design and the development of emerging creative talent.</p><p>As a fashion house, we celebrate the beauty of design through carefully crafted creations that reflect creativity, style and attention to detail. As a fashion academy, we provide a space where aspiring designers can explore their creative abilities, develop practical skills and discover the possibilities within the fashion industry.</p><p>We believe that every great design begins with an idea, every masterpiece requires craftsmanship, and every aspiring designer deserves an opportunity to grow.</p><p>Through our creations, learning experiences and the work of our students, we continue to celebrate the art of fashion and the people who bring it to life.</p><p class="about-signature">Jokel Fashion World &mdash; Where Creativity Meets Craftsmanship.</p></div></div><figure class="about-founder rv"><div class="about-founder-media">${ph("about",3,"","Joana Amissah, founder and creative director of Jokel Fashion World")}</div><figcaption class="about-founder-cap"><span class="about-founder-name">Joana Amissah</span><span class="about-founder-role">Founder &amp; Creative Director</span></figcaption></figure></div></section>
<section class="sec alt"><div class="w">${head("Jokel Fashion World","The values behind <em>our craft</em>")}<div class="about-values">${VALUES.map(v=>`<article class="vrow rv"><div class="vrow-head"><span class="n">${v.n}</span><h3>${v.t}</h3></div><div class="vrow-body"><p class="sub">${v.h}</p>${v.p.map(x=>`<p>${x}</p>`).join("")}</div></article>`).join("")}</div></div></section>${cta()}`,
academy:()=>`<section class="sec" style="padding-top:170px"><div class="w">${head("Fashion Academy","Train with <em>purpose</em>","Jokel Fashion Academy takes someone who has never touched a sewing machine and trains them to become confident in pattern drafting, cutting and sewing.")}</div></section>
<section class="sec alt"><div class="w two"><div class="vid rv"><video muted loop playsinline preload="metadata" data-amb poster="${C.images.s_tour}" src="${C.videos.tour}" aria-label="A walk through the Jokel Fashion World studio"></video></div><div>${head("Learning Journey","From first stitch to a complete outfit")}<div class="lst">${C.curriculum.map((c,i)=>`<div class="rv" style="grid-template-columns:50px 1fr"><span class="n">0${i+1}</span><span>${c[0]}</span></div>`).join("")}</div><div class="row rv"><a class="btn" href="#programmes">See the full curriculum</a></div></div></div></section>
<section class="sec"><div class="w">${head("Skills","What students can develop")}<p class="lead rv" style="margin-top:20px">Pattern drafting, cutting and sewing; skirts, blouses, sleeves, collars, trousers and dresses; professional garment finishing; and an introduction to corsetry, draping, kente and African fashion, garment pricing and running a fashion business.</p><div class="row rv"><a class="btn g" href="#programmes">View Programmes</a></div></div></section><section class="sec alt"><div class="w two"><div>${head("In the Classroom","Inside <em>our classes</em>","A look at a class in session.")}</div><div class="vid rv"><video muted loop playsinline preload="metadata" data-amb poster="${C.images.s_class}" src="${C.videos.class}" aria-label="A class in session at Jokel Fashion World"></video></div></div></section>${cta()}`,
programmes:()=>`<section class="sec" style="padding-top:170px"><div class="w">${head("Programmes","Learn the <em>craft</em>","Jokel Fashion Academy currently offers one programme.")}
${C.programmes.map(p=>`<div class="two rv" style="margin-top:56px;align-items:start"><div><span class="eye">Jokel Fashion Academy</span><h3 style="font-size:clamp(1.8rem,4vw,3rem);line-height:1.05">${p[0]}</h3><p class="lead" style="margin-top:18px">${p[1]}</p><dl style="margin-top:26px"><dt>Duration</dt><dd>6 months</dd><dt>Level</dt><dd>Beginner — no experience needed</dd><dt>Requirements</dt><dd>Open to complete beginners, no sewing experience needed.<details class="more"><summary><span class="rm">Read more</span><span class="rl">Read less</span></summary><p>Applicants should be 16 or older, able to read, write and take measurements, and committed to attending classes for the full six months. The academy provides all sewing equipment and tools.</p></details></dd><dt>Fee</dt><dd>Call us for fee details: <a href="tel:+233556213555" style="color:var(--gold)">${C.contact.phone}</a></dd></dl><div class="row"><a class="btn g" href="#admissions" data-prog="${p[0]}">Apply for this course</a><a class="btn" href="tel:+233556213555">Call about fees</a></div></div>${ph("s_bodice",3,"","Students fitting a bodice in the Jokel Fashion World studio")}</div>`).join("")}
<div style="margin-top:96px">${head("Curriculum","Six months, <em>step by step</em>")}<div style="margin-top:40px">${C.curriculum.map((c,i)=>`<details class="rv"><summary style="font-size:clamp(1.3rem,2.6vw,2rem)"><span><span class="mo">Month ${i+1}</span>${c[0]}</span></summary><div class="cmo"><ol>${c[1].map(x=>`<li>${x}</li>`).join("")}</ol><p class="prac"><b>${c[2]}:</b> ${c[3]}</p></div></details>`).join("")}</div></div></div></section>`,
admissions:()=>`<section class="sec" style="padding-top:170px"><div class="w"><div class="two"><div>${head("Admissions","Apply to <em>Jokel Fashion World</em>","Call us about the fee, send your application, and pay in person.")}</div>${ph("s_tee",2,"","A Jokel Fashion World student")}</div>
<div class="steps rv"><div><b>1 · Call us</b><span>Call to ask about the course fee and how to apply.</span></div><div><b>2 · Apply</b><span>Complete the application form below.</span></div><div><b>3 · Pay in person</b><span>Fees are paid face to face, not online.</span></div></div>
<form id="af" novalidate class="rv"><label>Full name<input name="n" required autocomplete="name"></label><label>Email<input name="e" type="email" required autocomplete="email"></label>
<label>Phone<input name="p" type="tel" required autocomplete="tel"></label><label>Date of birth<input name="d" type="date" required></label>
<label class="f">Residential address<input name="a" required autocomplete="street-address"></label>
<label>Programme of interest<select name="g" id="pg" required><option value="">Select…</option>${C.programmes.map(p=>`<option>${p[0]}</option>`).join("")}</select></label>
<label>Educational background<input name="b" required></label><label class="f">Additional information<textarea name="x" rows="3"></textarea></label>
<input type="hidden" name="website" value="" tabindex="-1" autocomplete="off">
<div class="f"><button class="btn g" type="submit">Submit Application</button></div><div class="note f" id="fm" hidden role="status"></div></form></div></section>`,
designs:()=>`<section class="sec" style="padding-top:170px"><div class="w">${head("Fashion House","The <em>portfolio</em>","Selected designs by Jokel Fashion World.")}${grid(C.designs,"d")}<div class="row rv"><a class="btn g" href="#contact">Enquire About a Custom Design</a></div></div></section>`,
students:()=>`<section class="sec" style="padding-top:170px"><div class="w">${head("Student Showcase","Made in <em>our studio</em>","Student names appear only with approval.")}${grid(C.students,"s")}</div></section>`,
achievements:()=>`<section class="sec" style="padding-top:170px"><div class="w">${head("Achievements","Milestones & <em>recognition</em>","Nothing is listed until verified by the owner.")}<div class="two" style="margin-top:48px">${ph("event",0,"","Fashion Showcase Awards 2026")}<div><span class="eye rv">Featured event</span><h3 class="rv">Fashion Showcase Awards 2026</h3><p class="lead rv" style="margin-top:14px">3rd May 2026, 1PM · Amasaman Stadium Junction.</p></div></div><div class="lst">${C.achievements.map(a=>`<div class="rv"><span class="n">${a[0]}</span><span>${a[1]}${a[3]?`<a class="lnk" href="${a[3]}" target="_blank" rel="noopener">Read the feature ↗</a>`:""}</span><span class="tag">${a[2]}</span></div>`).join("")}</div></div></section>`,
contact:()=>`<section class="sec" style="padding-top:170px"><div class="w two" style="align-items:start"><div>${head("Contact","Let's <em>talk</em>")}<dl class="rv" style="margin-top:32px"><dt>Phone</dt><dd><a href="tel:+233556213555">${C.contact.phone}</a></dd><dt>Email</dt><dd><a href="mailto:${C.contact.email}">${C.contact.email}</a></dd><dt>Location</dt><dd>${C.contact.location}</dd></dl><a class="btn rv" style="margin-top:24px" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=Better%20Future%20Academy%20Achiaman%20Ghana">Open in Google Maps</a></div>
<form id="cf" novalidate class="rv" style="margin-top:0"><label class="f">Name<input name="name" required></label><label class="f">Email<input name="email" type="email" required></label><label class="f">Enquiry type<select name="enquiry_type" required><option value="">Select…</option><option value="admissions">Admissions</option><option value="custom_design">Custom design / business</option><option value="general">General</option></select></label><label class="f">Message<textarea name="message" rows="4" required></textarea></label><input type="hidden" name="website" value="" tabindex="-1" autocomplete="off"><div class="f"><button class="btn g" type="submit">Send Message</button></div><div class="note f" id="cm" hidden role="status"></div></form></div></section>`
};
/* ===== ENGINE ===== */
$("#nv").innerHTML=PAGES.map((p,i)=>`<a href="#${p[0]}" data-p="${p[0]}" style="--i:${i}">${p[1]}</a>`).join("");
$("#fl").innerHTML=PAGES.slice(0,5).map(p=>`<a href="#${p[0]}">${p[1]}</a>`).join("");
$("#fc").innerHTML=C.contact.social.map(s=>`<a href="${s[1]}">${s[0]}</a>`).join("")+`<a href="tel:+233556213555">${C.contact.phone}</a><a href="mailto:${C.contact.email}">${C.contact.email}</a><a href="#contact">${C.contact.location}</a>`;
$("#ft").textContent=C.tagline;$("#yr").textContent=new Date().getFullYear();document.querySelectorAll(".lg").forEach(i=>i.src=LOGO);{const l=document.createElement("link");l.rel="icon";l.href=LOGO;document.head.appendChild(l)}
const rm=matchMedia("(prefers-reduced-motion:reduce)").matches;
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");e.target.querySelectorAll(":scope>.ph.rv").forEach(x=>x.classList.add("in"));io.unobserve(e.target)}}),{threshold:.12});
const ioV=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(e.isIntersecting){if(v.dataset.amb!==undefined||v.dataset.autoplay==="1"){v.play().catch(()=>{})}}else{if(!v.closest('.vid-tile.playing-long')||v.dataset.amb!==undefined) v.pause()}}),{threshold:.35});
function setupTileVideos(root=document){
  root.querySelectorAll('.vid-tile').forEach(tile=>{
    const v=tile.querySelector('video');const btn=tile.querySelector('.play'); if(!v||!btn) return;
    if(!v.src && v.dataset.src){ v.src=v.dataset.src; }
    const setShort=()=>{ if(rm){ v.controls=true; btn.style.display='none'; return; } v.muted=true; v.loop=true; v.dataset.autoplay='1'; tile.classList.add('autoplaying'); btn.style.display='none'; v.play().catch(()=>{ btn.style.display=''; v.controls=false; }); };
    const setLong=()=>{ tile.classList.add('long-video'); btn.style.display=''; v.controls=false; v.removeAttribute('autoplay'); };
    if(v.readyState>=1){ (v.duration && v.duration <= 12) ? setShort() : setLong(); }
    else v.addEventListener('loadedmetadata',()=>{ (v.duration && v.duration <= 12) ? setShort() : setLong(); },{once:true});
    v.addEventListener('error',()=>{ btn.style.display=''; btn.textContent='!'; btn.title='Video unavailable'; v.controls=true; });
    const toggle=async(ev)=>{ ev.stopPropagation(); if(v.paused){ tile.classList.add('playing-long'); v.muted=false; v.controls=true; try{ await v.play(); btn.style.display='none'; }catch(e){ v.muted=true; try{ await v.play(); btn.style.display='none'; }catch(_){ btn.style.display=''; } } } else { v.pause(); btn.style.display=''; } };
    btn.addEventListener('click',toggle);
    tile.addEventListener('click',(ev)=>{ if(ev.target.closest('.play')) return; if(tile.classList.contains('long-video')||v.controls){ toggle(ev); } });
    if(!rm) ioV.observe(v);
  });
}
function go(){let h=location.hash.slice(1);if(!R[h])h="home";$("#m").innerHTML=R[h]();
 if(!$("#m").querySelector("h1")){$("#m").querySelector("h2")?.setAttribute("aria-level","1");$("#m").querySelector("h2")?.setAttribute("role","heading")}document.title=(h=="home"?"Jokel Fashion World — Fashion House & Academy":PAGES.find(p=>p[0]==h)[1]+" — Jokel Fashion World");
 document.querySelectorAll("nav a").forEach(a=>a.classList.toggle("on",a.dataset.p==h));
 setMenu(false);scrollTo(0,0);if(!rm)$("#m").animate([{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],{duration:600,easing:"ease-out"});
 document.querySelectorAll(".rv").forEach(e=>io.observe(e.classList.contains("ph")?e.parentElement:e));document.querySelectorAll("video[data-amb]").forEach(v=>{v.dataset.amb="1";if(rm){v.controls=true}else{ioV.observe(v);v.play().catch(()=>{})}});setupTileVideos(document);
 async function handleSubmit(form, endpoint, msgEl, successMsg) {
   const btn = form.querySelector('button[type="submit"]');
   const originalBtnText = btn.textContent;
   btn.disabled = true;
   btn.textContent = 'Sending...';
   msgEl.hidden = false;
   msgEl.textContent = '';
   msgEl.className = 'note f';

   const fd = new FormData(form);
   const data = Object.fromEntries(fd.entries());

   try {
     const res = await fetch(endpoint, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(data)
     });
     const result = await res.json();
     if (res.ok && result.success) {
       msgEl.textContent = successMsg;
       msgEl.classList.add('success');
       form.reset();
       if (result.reference) {
         msgEl.textContent += ' Your reference: ' + result.reference;
       }
     } else {
       msgEl.textContent = result.error || 'Submission failed. Please try again.';
       msgEl.classList.add('error');
     }
   } catch (e) {
     msgEl.textContent = 'Network error. Please check your connection and try again.';
     msgEl.classList.add('error');
   } finally {
     btn.disabled = false;
     btn.textContent = originalBtnText;
   }
 }
 const af = $("#af"); if (af) af.onsubmit = ev => { ev.preventDefault(); handleSubmit(af, '/api/application', $("#fm"), 'Application submitted successfully!'); };
 const cf = $("#cf"); if (cf) cf.onsubmit = ev => { ev.preventDefault(); handleSubmit(cf, '/api/enquiry', $("#cm"), 'Message sent successfully!'); }
}
addEventListener("hashchange",go);go();
function setMenu(o){$("#nv").classList.toggle("open",o);document.querySelector("header").classList.toggle("open",o);$("#bg").setAttribute("aria-expanded",o);$("#bg").textContent=o?"Close":"Menu";document.body.style.overflow=o?"hidden":""}
$("#bg").onclick=()=>setMenu(!$("#nv").classList.contains("open"));document.querySelectorAll("nav a").forEach(a=>a.addEventListener("click",()=>setMenu(false)));
document.addEventListener("click",e=>{const t=e.target.closest(".t");if(t && !t.classList.contains("vid-tile")){const l=$("#li");l.style.setProperty("--h",(t.dataset.i*47+(t.closest(".mos")?28:0))%360);l.dataset.l=t.dataset.t;{const u=C.images[t.dataset.k];l.style.backgroundImage=u?`url('${u}')`:"";l.style.backgroundSize=u?"contain":"";l.style.backgroundPosition=u?"center":"";l.style.backgroundRepeat="no-repeat";l.classList.toggle("img",!!u)}$("#lt").textContent=t.dataset.t;const v=$("#lv");$("#lb").classList.remove("vid");$("#lb").classList.add("on");$("#lc").focus()}
 const p=e.target.closest("[data-prog]");if(p)setTimeout(()=>{const s=$("#pg");if(s)s.value=p.dataset.prog},50)});
const cl=()=>{$("#lb").classList.remove("on");const v=$("#lv");v.pause();v.removeAttribute("src");v.load()};$("#lc").onclick=cl;$("#lb").onclick=e=>{if(e.target.id=="lb")cl()};addEventListener("keydown",e=>{if(e.key=="Escape"){cl();setMenu(false)}});
const pb=$("#pb");addEventListener("scroll",()=>{pb.style.transform=`scaleX(${scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)})`},{passive:true});
if(!rm&&matchMedia("(pointer:coarse)").matches)addEventListener("pointerdown",e=>{const r=document.createElement("div");r.className="rip";r.style.left=e.clientX+"px";r.style.top=e.clientY+"px";document.body.appendChild(r);setTimeout(()=>r.remove(),700)});
if(!rm){addEventListener("scroll",()=>{const p=$(".hero .ph");if(p&&scrollY<innerHeight)p.style.transform=`translateY(${scrollY*.18}px)`},{passive:true});
 if(matchMedia("(pointer:fine)").matches){const c=$("#cur");addEventListener("mousemove",e=>{c.style.left=e.clientX+"px";c.style.top=e.clientY+"px";c.classList.add("show");c.classList.toggle("big",!!e.target.closest(".t"))})}}
