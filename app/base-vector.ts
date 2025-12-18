// app.base-vector.ts
import CoinbaseWalletSDK from "@coinbase/wallet-sdk";
import { createPublicClient, http, formatEther, isAddress } from "viem";
import { base, baseSepolia } from "viem/chains";

type Network = {
  chain: typeof base;
  chainId: number;
  rpc: string;
  explorer: string;
  label: string;
};

const NETWORKS: Record<"mainnet" | "sepolia", Network> = {
  mainnet: {
    chain: base,
    chainId: 8453,
    rpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    label: "Base Mainnet",
  },
  sepolia: {
    chain: baseSepolia,
    chainId: 84532,
    rpc: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    label: "Base Sepolia",
  },
};

let active: Network = NETWORKS.sepolia;

const APP = {
  name: "Base Vector (Built for Base)",
  logo: "https://base.org/favicon.ico",
};

const out = document.createElement("pre");
out.style.whiteSpace = "pre-wrap";
out.style.wordBreak = "break-word";
out.style.background = "#0b0f1a";
out.style.color = "#dbe7ff";
out.style.padding = "14px";
out.style.borderRadius = "14px";
out.style.border = "1px solid rgba(255,255,255,0.12)";
out.style.minHeight = "320px";

function render(lines: string[]) {
  out.textContent = lines.join("\n");
}

function client() {
  return createPublicClient({ chain: active.chain, transport: http(active.rpc) });
}

async function connectWallet() {
  const sdk = new CoinbaseWalletSDK({ appName: APP.name, appLogoUrl: APP.logo });
  const provider = sdk.makeWeb3Provider(active.rpc, active.chainId);

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("No address returned from wallet");

  const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
  return { provider, address, chainId: parseInt(chainIdHex, 16) };
}

async function readSummary(address: string) {
  const c = client();
  const [block, balance] = await Promise.all([
    c.getBlockNumber(),
    c.getBalance({ address: address as `0x${string}` }),
  ]);
  return { block, balance };
}

async function readBlockMeta() {
  const b = await client().getBlock();
  return { number: b.number, timestamp: b.timestamp, gasUsed: b.gasUsed };
}

async function readBalance(addr: string) {
  if (!isAddress(addr)) throw new Error("Invalid address");
  return client().getBalance({ address: addr as `0x${string}` });
}

let session: { address: string; chainId: number } | null = null;

function mount() {
  const root = document.createElement("div");
  root.style.maxWidth = "1100px";
  root.style.margin = "28px auto";
  root.style.fontFamily = "ui-sans-serif, system-ui";

  const title = document.createElement("h1");
  title.textContent = APP.name;

  const subtitle = document.createElement("div");
  subtitle.textContent =
    "Wallet connect, Base chain validation, and extended read-only vector of onchain signals.";
  subtitle.style.opacity = "0.8";

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.flexWrap = "wrap";
  controls.style.gap = "10px";
  controls.style.margin = "14px 0";

  const btnConnect = document.createElement("button");
  btnConnect.textContent = "Connect Wallet";

  const btnToggle = document.createElement("button");
  btnToggle.textContent = "Toggle Network";

  const btnMeta = document.createElement("button");
  btnMeta.textContent = "Block Meta";
  btnMeta.disabled = true;

  const addrInput = document.createElement("input");
  addrInput.placeholder = "0x… address";
  addrInput.style.minWidth = "260px";

  const btnAddr = document.createElement("button");
  btnAddr.textContent = "Check Balance";
  btnAddr.disabled = true;

  btnToggle.onclick = () => {
    active = active.chainId === 84532 ? NETWORKS.mainnet : NETWORKS.sepolia;
    session = null;
    btnMeta.disabled = true;
    btnAddr.disabled = true;
    render([`Network switched to ${active.label}. Reconnect wallet.`]);
  };

  btnConnect.onclick = async () => {
    try {
      render(["Connecting wallet…"]);
      session = await connectWallet();
      const info = await readSummary(session.address);
      btnMeta.disabled = false;
      btnAddr.disabled = false;

      render([
        "Connected",
        `Network: ${active.label}`,
        `chainId: ${session.chainId}`,
        `Address: ${session.address}`,
        `ETH balance: ${formatEther(info.balance)} ETH`,
        `Latest block: ${info.block}`,
        `Explorer: ${active.explorer}/address/${session.address}`,
      ]);
    } catch (e: any) {
      render([`Error: ${e?.message ?? String(e)}`]);
    }
  };

  btnMeta.onclick = async () => {
    try {
      render(["Reading block metadata…"]);
      const m = await readBlockMeta();
      render([
        "Block Metadata",
        `Network: ${active.label}`,
        `Block number: ${m.number}`,
        `Timestamp: ${m.timestamp}`,
        `Gas used: ${m.gasUsed}`,
        `Explorer: ${active.explorer}/block/${m.number}`,
      ]);
    } catch (e: any) {
      render([`Error: ${e?.message ?? String(e)}`]);
    }
  };

  btnAddr.onclick = async () => {
    try {
      const target = addrInput.value || session?.address;
      if (!target) throw new Error("No address provided");
      render(["Reading address balance…"]);
      const bal = await readBalance(target);
      render([
        "Address Balance",
        `Network: ${active.label}`,
        `Address: ${target}`,
        `ETH balance: ${formatEther(bal)} ETH`,
        `Explorer: ${active.explorer}/address/${target}`,
      ]);
    } catch (e: any) {
      render([`Error: ${e?.message ?? String(e)}`]);
    }
  };

  [btnConnect, btnToggle, btnMeta, addrInput, btnAddr].forEach((el) => {
    el.style.padding = "8px 10px";
    controls.appendChild(el);
  });

  root.append(title, subtitle, controls, out);
  document.body.appendChild(root);

  render([
    "Ready.",
    `Active network: ${active.label} (chainId ${active.chainId})`,
    "Connect wallet to begin.",
  ]);
}

mount();
