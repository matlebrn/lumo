"""Protection niveau banque : code obligatoire, confirmation des actions sensibles, déconnexion après 10 codes faux."""


def test_code_obligatoire_sur_un_vrai_compte(make_app):
    app = make_app()
    app.js("S=DEF();S.obd=1;S.pin='';save();tab='home';render()"); app.wait(300)
    assert app.js("return !!document.getElementById('kforce')")
    app.page.fill('#kf1', '1234'); app.page.fill('#kf2', '1234'); app.js("kForceSave(0)"); app.wait(200)
    assert app.js("return !!document.getElementById('kforce') && !S.pin"), 'code trop simple refusé'
    app.page.fill('#kf1', '8361'); app.page.fill('#kf2', '8361'); app.js("kForceSave(0)"); app.wait(600)
    assert app.js("return !document.getElementById('kforce') && String(S.pin).startsWith('pb2$')")


def test_export_redemande_le_code(make_app):
    app = make_app()
    app.js("S=DEF();S.obd=1;S.acc=[{id:'a',name:'C',type:'Compte courant',bal:10}];S.pin=await kPinMake('8361');save();window.__e=0;"
           "const f=window.exp.__kg?null:0;render()")
    app.js("window.__p=exp()"); app.wait(200)
    assert app.js("return !!document.getElementById('kre')")
    app.page.fill('#krei', '0000'); app.wait(900)
    assert app.js("return !!document.getElementById('kre') && S.pinF===1 && S.sec[0].e==='fail'")
    app.page.fill('#krei', '8361'); app.wait(900)
    assert app.js("return !document.getElementById('kre') && S.sec[0].e==='exp'")


def test_dix_codes_faux_deconnectent(make_app):
    app = make_app()
    app.js("window.__out=0;KSA.logout=()=>{window.__out=1};S=DEF();S.obd=1;S.pin=await kPinMake('8361');S.pinF=9;S.pinT=0;save();locked=true;pinBuf='';renderLock()")
    for k in '0000': app.js(f"await kp('{k}')")
    app.wait(1800)
    assert app.js("return window.__out===1 && S.sec.some(x=>x.e==='out')")


def test_code_oublie(make_app):
    app = make_app()
    app.js("window.__out=0;KSA.logout=()=>{window.__out=1};S=DEF();S.obd=1;S.pin=await kPinMake('8361');save();locked=true;renderLock()")
    assert app.js("return !!document.getElementById('kforgot')")
    app.js("kForgot()"); app.js("await kForgotGo()"); app.wait(200)
    assert app.js("return window.__out===1 && localStorage.getItem('lumo-pinreset')===PKEY")
