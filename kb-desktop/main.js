const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "KB Project",
    // Ícone da janela no modo dev (npm start); o app instalado usa o do .exe
    icon: path.join(__dirname, "build", "icon.ico"),
    // backgroundColor: "#0a0806",
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Remove o menu padrão (File/Edit/View...) para parecer um app de verdade
  Menu.setApplicationMenu(null);

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    // No macOS, reabre a janela ao clicar no ícone do dock
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // No macOS os apps normalmente ficam ativos até Cmd+Q
  if (process.platform !== "darwin") app.quit();
});
