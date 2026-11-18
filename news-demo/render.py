from pathlib import Path
import math, subprocess, wave, struct, json
from PIL import Image, ImageDraw, ImageFont
from functools import lru_cache
OUT=Path('demo-output'); OUT.mkdir(exist_ok=True)
W,H,FPS=720,1280,25
BG='#101f30'; PANEL='#172d40'; INK='#fbf5e8'; TEAL='#62ddc3'; MUTE='#a4b9c6'; LINE='#345364'; GOLD='#f5bf74'
@lru_cache(None)
def font(size,dev=False,bold=False):
    pattern='*Devanagari*'+('Bold' if bold else 'Regular')+'.ttf' if dev else ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')
    paths=sorted(Path('/usr/share/fonts').rglob(pattern),key=lambda p:('Sans' not in p.name,str(p)))
    return ImageFont.truetype(str(paths[0]),size)
def run(*args):
    subprocess.run([str(arg) for arg in args],check=True)
scenes=[
('01 / THE QUESTION','वीडियो में क्या दिखा?','एक जेट तेज़ी से नीचे आता दिखा।\nक्या इतनी तस्वीर वजह भी बता सकती है?', 'फ़्लोरिडा के इस वीडियो में एक जेट तेज़ी से नीचे आता दिखा। लेकिन क्या आख़िरी कुछ सेकंड देखकर हम बता सकते हैं कि ऐसा क्यों हुआ?'),
('02 / THE FLIGHT','यह उड़ान कहाँ जा रही थी?','ऑस्टिन, टेक्सस से नॉर्थ एल्यूथरा,\nबहामास की ओर उड़ान जा रही थी।','एक नवंबर, दो हज़ार छब्बीस। लियरजेट साठ, टेक्सस के ऑस्टिन से बहामास जा रहा था। वह फ़्लोरिडा में ग्रीनएकर्स के पास दुर्घटनाग्रस्त हुआ।'),
('03 / ON BOARD','विमान में नौ लोग थे।','सात यात्री और चालक दल के दो सदस्य।\nइस हादसे में सभी की जान गई।','विमान में सात यात्री और चालक दल के दो सदस्य थे। इस हादसे में सभी नौ लोगों की जान गई।'),
('04 / THE EVIDENCE','जाँच को क्या मिला?','कॉकपिट वॉइस रिकॉर्डर मिला।\nवॉशिंगटन की लैब में उसकी जाँच शुरू हुई।','नौ नवंबर को अमेरिका की जाँच एजेंसी ने बताया कि कॉकपिट वॉइस रिकॉर्डर मिल गया था। उसे जाँच के लिए वॉशिंगटन की लैब ले जाया गया।'),
('05 / THE DISTINCTION','दृश्य और वजह में फ़र्क','वीडियो में गिरावट दिखी।\nअंतिम कारण अभी तय नहीं हुआ है।','यही फ़र्क है। वीडियो गिरावट दिखाता है। उसकी वजह समझने के लिए जाँचकर्ता रिकॉर्डर और मलबे के सबूत मिलाते हैं। जाँच अभी जारी है।')]
def txt(d,at,word,f,fill=INK,**kw): d.text(at,word,font=f,fill=fill,**kw)
small=font(17,False,True); tag=font(21,False,True); big=font(42,True,True); sub=font(29,True); note=font(19); num=font(72,False,True)
def jet(d,x,y,s,angle=0):
    points=[(34,0),(14,-4),(0,-5),(-15,-23),(-20,-23),(-13,-5),(-26,-4),(-32,-11),(-36,-11),(-31,0),(-36,11),(-32,11),(-26,4),(-13,5),(-20,23),(-15,23),(0,5),(14,4)]
    ca,sa=math.cos(angle),math.sin(angle)
    d.polygon([(x+s*(px*ca-py*sa),y+s*(px*sa+py*ca)) for px,py in points],fill=INK)
def frame(i,p):
    im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
    txt(d,(48,73),'F I E L D N O T E   /   H I N D I',small,TEAL)
    txt(d,(48,120),'FLORIDA   /   LEARJET 60',tag);d.line((48,168,672,168),fill=LINE,width=2)
    txt(d,(48,202),scenes[i][0],small,GOLD);txt(d,(48,250),scenes[i][1],big)
    d.rounded_rectangle((48,385,672,826),radius=24,fill=PANEL)
    for xx in range(82,655,34):
        for yy in range(418,799,34): d.ellipse((xx,yy,xx+2,yy+2),fill=LINE)
    if i==0:
        txt(d,(78,416),'ILLUSTRATION  /  NOT ACTUAL FOOTAGE',small,MUTE)
        for j in range(4):d.line((100,685+j*14,615,685+j*14),fill=LINE,width=2)
        jet(d,325+p*45,565+p*30,3.1,.64)
        txt(d,(80,762),'01 NOV 2026     /     GREENACRES, FL',small,TEAL)
    elif i==1:
        txt(d,(78,415),'PLANNED ROUTE  /  SCHEMATIC',small,MUTE)
        d.line((110,610,600,610),fill=LINE,width=5)
        d.line((110,610,110+480*min(1,p*1.8),610),fill=TEAL,width=5)
        for xx,name in [(110,'AUS'),(600,'MYEH')]:
            d.ellipse((xx-9,601,xx+9,619),fill=INK);txt(d,(xx,645),name,tag,anchor='mt')
        txt(d,(78,752),'AUSTIN  →  NORTH ELEUTHERA',tag,GOLD)
    elif i==2:
        txt(d,(80,420),'PEOPLE ON BOARD',small,MUTE)
        for j in range(9):
            x=113+(j%5)*96;y=526+(j//5)*89
            c=GOLD if j>=7 else TEAL
            d.ellipse((x-11,y-21,x+11,y+1),fill=c);d.rounded_rectangle((x-23,y+7,x+23,y+30),radius=10,fill=c)
        txt(d,(80,748),'7 PASSENGERS   +   2 CREW',tag)
    elif i==3:
        d.rounded_rectangle((155,521,560,668),radius=18,fill='#c47641',outline=GOLD,width=3)
        txt(d,(183,546),'COCKPIT VOICE',tag,BG);txt(d,(183,598),'RECORDER',tag,BG)
        for x in [174,541]:
            for y in [537,651]:d.ellipse((x-3,y-3,x+3,y+3),fill=INK)
        txt(d,(78,418),'EVIDENCE  /  RECORDER ILLUSTRATION',small,MUTE)
        txt(d,(78,749),'09 NOV   /   NTSB UPDATE',tag,TEAL)
    else:
        txt(d,(81,445),'OBSERVED',small,TEAL);txt(d,(81,485),'Steep descent',font(37,False,True))
        d.line((81,575,615,575),fill=LINE,width=2)
        txt(d,(81,620),'PROBABLE CAUSE',small,GOLD);txt(d,(81,664),'Under investigation',font(34,False,True))
    for j,line in enumerate(scenes[i][2].split('\n')):txt(d,(52,883+j*57),line,sub)
    d.line((50,1075,666,1075),fill=LINE,width=2)
    txt(d,(52,1100),('SOURCE  /  FLORIDA STATE BRIEFING  ·  AP' if i==2 else 'SOURCE  /  NTSB   ·   ERA27MA026'),small,MUTE)
    txt(d,(52,1140),'18 NOV 2026     /     ORIGINAL GRAPHICS',small,MUTE)
    for j in range(5):
        x=52+122*j;d.rectangle((x,1203,x+104,1207),fill=LINE)
        if j<=i:d.rectangle((x,1203,x+int(104*(p if j==i else 1)),1207),fill=TEAL)
    return im
chunks=[];nframes=[];rate=22050
for i,s in enumerate(scenes):
    path=OUT/('v%d.wav'%i)
    run('espeak-ng','-v','hi','-s','158','-p','43','-w',path,s[3])
    with wave.open(str(path),'rb') as inp:
        rate=inp.getframerate();data=inp.readframes(inp.getnframes())
    data=b'\0\0'*int(rate*.18)+data+b'\0\0'*int(rate*.35)
    frames=math.ceil(len(data)/2/rate*FPS);nframes.append(frames)
    chunks.append(data.ljust(round(frames*rate/FPS)*2,b'\0'))
with wave.open(str(OUT/'voice.wav'),'wb') as out:
    out.setparams((1,2,rate,0,'NONE','not compressed'));out.writeframes(b''.join(chunks))
def stamp(t):
    ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
start=0;lines=[]
for i,count in enumerate(nframes):
    end=start+count/FPS;lines.append(f'{i+1}\n{stamp(start)} --> {stamp(end)}\n{scenes[i][3]}\n');start=end
(OUT/'hindi.srt').write_text('\n'.join(lines),encoding='utf-8')
dur=sum(nframes)/FPS
encoder=subprocess.Popen(['ffmpeg','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','720x1280','-r',str(FPS),'-i','-','-i',str(OUT/'voice.wav'),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(OUT/'florida-learjet-hindi.mp4')],stdin=subprocess.PIPE)
for i,count in enumerate(nframes):
    for k in range(count):
        pic=frame(i,k/max(count-1,1));encoder.stdin.write(pic.tobytes())
        if k==count//2:pic.resize((270,480)).save(OUT/('preview%d.jpg'%i))
encoder.stdin.close()
assert encoder.wait()==0
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(OUT/'florida-learjet-hindi.mp4')]))
video,audio=probe['streams'];assert video['width']==720 and video['height']==1280 and audio['codec_name']=='aac' and abs(float(probe['format']['duration'])-dur)<.2
sheet=Image.new('RGB',(270*5,480)); 
for i in range(5):sheet.paste(Image.open(OUT/('preview%d.jpg'%i)),(270*i,0))
sheet.save(OUT/'preview.jpg')
import base64
print('PREVIEW '+base64.b64encode((OUT/'preview.jpg').read_bytes()).decode())
print('VERIFIED',dur,'seconds, 720x1280 H.264 / AAC')
