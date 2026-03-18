#!/bin/bash
# 使用此链接安装: wget -O install.sh https://raw.githubusercontent.com/Hollowwill521/scripts/refs/heads/main/sh/install_telebox.sh && chmod +x install.sh && ./install.sh
# =================================================================
# TeleBox Pro 部署助手 V7.0 (尊享智能版)
# 特性：动态基准路径、可视化备份/卸载菜单、雷达防冲突、防呆设计
# =================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# --- 0. Root 软警告 (把选择权交还) ---
if [[ "$EUID" -eq 0 ]]; then
    echo -e "${RED}⚠️  警告: 检测到您正在以 Root 身份 (或 sudo) 运行此脚本！${NC}"
    echo -e "${YELLOW}强烈建议使用普通用户运行。强行以 root 运行会导致数据绑定在 root 名下。${NC}"
    read -p "是否确信要以 Root 身份强行继续？[y/N]: " ROOT_CONFIRM
    if [[ "${ROOT_CONFIRM,,}" != "y" ]]; then
        echo -e "${GREEN}已安全退出。请切换普通用户后重试。${NC}"
        exit 0
    fi
    echo -e "${RED}已开启 Root 强制运行模式，后果自负。${NC}"
fi

CURRENT_USER=$(whoami)
USER_GROUP=$(id -gn)
NODE_VERSION="20"

# --- 1. 基础依赖预检 (为了菜单能正常读取数据) ---
if ! command -v jq &> /dev/null || ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}首次运行，正在准备核心组件 (jq, pm2)...${NC}"
    sudo apt update -q
    sudo apt install -y jq npm &>/dev/null
    sudo npm install -g pm2 &>/dev/null
fi

# --- 2. 核心：动态路径与端口嗅探 ---
detect_next_instance() {
    # 嗅探已有机器人的安装路径
    local existing_cwd=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | test("telebox")) | .pm2_env.pm_cwd' | head -n 1)
    if [[ -n "$existing_cwd" && "$existing_cwd" != "null" ]]; then
        BASE_PATH=$(dirname "$existing_cwd")
    else
        BASE_PATH="$HOME" # 如果没有老机器人，默认装在用户主目录
    fi

    # 嗅探安全的实例名
    local count=1
    while true; do
        if [[ -d "$BASE_PATH/telebox$count" ]] || pm2 list 2>/dev/null | grep -q "telebox$count"; then
            ((count++))
        else
            NEXT_NAME="telebox$count"
            break
        fi
    done

    # 嗅探安全的空闲端口
    NEXT_PORT=18080
    while true; do
        if ss -tuln | grep -q ":$NEXT_PORT " ; then
            ((NEXT_PORT++))
        else
            break
        fi
    done
}

# --- 3. 完整环境治理 ---
check_environment() {
    clear
    echo -e "${BLUE}[系统环境深度检查]${NC}"
    if [[ $(free -m | grep Swap | awk '{print $2}') -lt 1000 ]]; then
        echo -e "${YELLOW}检测到内存较小，自动创建虚拟内存...${NC}"
        sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile &>/dev/null
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab &>/dev/null
    fi
    
    sudo apt update -q
    sudo apt install -y git python3 python3-pip build-essential curl jq iproute2 &>/dev/null
    
    if ! node -v 2>/dev/null | grep -q "v$NODE_VERSION"; then
        echo -e "${YELLOW}正在安装 Node.js $NODE_VERSION...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
}

# ======================= 主程序菜单 =======================

detect_next_instance

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}    TeleBox 部署助手 V7.0 (尊享智能版)   ${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "雷达嗅探完毕，自动规划的接力配置："
echo -e "  基准安装路径: [ ${YELLOW}$BASE_PATH${NC} ]"
echo -e "  目录/进程名 : [ ${YELLOW}$NEXT_NAME${NC} ]"
echo -e "  空闲独立端口: [ ${YELLOW}$NEXT_PORT${NC} ]"
echo -e "-----------------------------------------"
echo -e "1. 全新安装 (Userbot 登录，需填 API ID)"
echo -e "2. 恢复备份 (已有 config.json)"
echo -e "3. 备份导出 (列表选择已有机器人)"
echo -e "4. 一键卸载 (列表选择已有机器人)"
echo -e "5. 退出"
read -p "请选择 [1-5]: " MODE

if [[ "$MODE" == "5" ]]; then exit 0; fi

# ======================= 闭环管理：可视化备份与卸载 =======================
if [[ "$MODE" == "3" || "$MODE" == "4" ]]; then
    echo -e "\n${YELLOW}>>> 检索运行中的 TeleBox 实例 <<<${NC}"
    # 使用 jq 获取名字和对应的文件夹路径
    mapfile -t BOT_NAMES < <(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | test("telebox")) | .name')
    mapfile -t BOT_CWDS < <(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | test("telebox")) | .pm2_env.pm_cwd')

    if [[ ${#BOT_NAMES[@]} -eq 0 ]]; then
        echo -e "${RED}❌ 未检测到任何正在运行的 TeleBox 进程！${NC}"
        exit 1
    fi

    # 打印可视化列表
    for i in "${!BOT_NAMES[@]}"; do
        echo -e "  [${GREEN}$((i+1))${NC}] ${BOT_NAMES[$i]} (路径: ${BLUE}${BOT_CWDS[$i]}${NC})"
    done

    read -p "请输入对应的序号 [1-${#BOT_NAMES[@]}]: " SEL_IDX
    if [[ ! "$SEL_IDX" =~ ^[0-9]+$ ]] || [ "$SEL_IDX" -lt 1 ] || [ "$SEL_IDX" -gt "${#BOT_NAMES[@]}" ]; then
        echo -e "${RED}输入无效，已退出。${NC}"
        exit 1
    fi

    TARGET_NAME="${BOT_NAMES[$((SEL_IDX-1))]}"
    TARGET_DIR="${BOT_CWDS[$((SEL_IDX-1))]}"

    # --- 执行备份 ---
    if [[ "$MODE" == "3" ]]; then
        echo -e "\n${YELLOW}建议将备份统一放在独立的数据盘 (例如: /vol1/telebox_export/$TARGET_NAME)${NC}"
        read -p "请输入备份存放路径 (默认: $BASE_PATH/${TARGET_NAME}_backup): " INPUT_BACKUP
        BACKUP_DIR=${INPUT_BACKUP:-"$BASE_PATH/${TARGET_NAME}_backup"}
        
        mkdir -p "$BACKUP_DIR"
        cp -f "$TARGET_DIR/config.json" "$BACKUP_DIR/" 2>/dev/null
        cp -f "$TARGET_DIR/ecosystem.config.js" "$BACKUP_DIR/" 2>/dev/null
        
        echo -e "${GREEN}✅ 备份成功！${NC}"
        echo -e "配置已安全导出至: ${YELLOW}$BACKUP_DIR${NC}"
        ls -l "$BACKUP_DIR"
        exit 0
    fi

    # --- 执行卸载 ---
    if [[ "$MODE" == "4" ]]; then
        echo -e "\n${RED}警告：此操作将删除进程 [$TARGET_NAME] 并彻底清空文件夹 [$TARGET_DIR]！${NC}"
        read -p "确认彻底删除? (y/n): " CONFIRM_DEL
        if [[ "$CONFIRM_DEL" == "y" ]]; then
            pm2 delete "$TARGET_NAME" &>/dev/null
            pm2 save &>/dev/null
            rm -rf "$TARGET_DIR"
            echo -e "${GREEN}✅ 机器人 $TARGET_NAME 已被骨灰级清理！${NC}"
        else
            echo "已取消卸载。"
        fi
        exit 0
    fi
fi

# ======================= 安装/恢复流程 =======================
check_environment

echo -e "\n${YELLOW}>>> 实例配置确认 <<<${NC}"
read -p "确认机器人名称 (默认 $NEXT_NAME): " INPUT_NAME
BOX_NAME=${INPUT_NAME:-$NEXT_NAME}
INSTALL_PATH="$BASE_PATH/$BOX_NAME"

if [[ -d "$INSTALL_PATH" ]]; then
    read -p "目录已存在，是否删除重装? (y/n): " DEL_CONFIRM
    [[ "$DEL_CONFIRM" == "y" ]] && pm2 delete "$BOX_NAME" &>/dev/null && rm -rf "$INSTALL_PATH" || exit 1
fi

# --- 拉取代码 (含网络加速) ---
echo -e "\n${YELLOW}>>> 拉取最新代码... <<<${NC}"
read -p "是否使用 GitHub 加速代理 (服务器拉取慢时选 y)? [y/n]: " USE_PROXY
if [[ "${USE_PROXY,,}" == "y" ]]; then
    GIT_URL="https://ghproxy.com/https://github.com/TeleBoxOrg/TeleBox.git"
else
    GIT_URL="https://github.com/TeleBoxOrg/TeleBox.git"
fi
git clone "$GIT_URL" "$INSTALL_PATH"
sudo chown -R $CURRENT_USER:$USER_GROUP "$INSTALL_PATH"
cd "$INSTALL_PATH"

# --- 处理 Config 与 Ecosystem ---
if [[ "$MODE" == "1" ]]; then
    echo -e "\n${YELLOW}>>> 填写配置 <<<${NC}"
    [[ -f "config.example.json" ]] && cp config.example.json config.json || echo '{}' > config.json
    
    echo -e "${GREEN}即将打开编辑器，请填入 api_id 和 api_hash。${NC}"
    echo -e "${GREEN}bot_token 请留空 (Userbot 稍后会输手机号)。${NC}"
    read -p "按回车打开编辑器..."
    nano config.json
    
    read -p "确认端口号 (雷达建议 $NEXT_PORT): " INPUT_PORT
    PORT=${INPUT_PORT:-$NEXT_PORT}

    cat > ecosystem.config.js <<EOF
module.exports = {
  apps : [{
    name: "$BOX_NAME",
    script: "node_modules/.bin/tsx",
    args: "src/index.ts",
    cwd: "$INSTALL_PATH",
    env: { NODE_ENV: "production", PORT: $PORT },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF

elif [[ "$MODE" == "2" ]]; then
    echo -e "\n${YELLOW}>>> 恢复备份 <<<${NC}"
    read -p "请输入备份路径: " BACKUP_PATH
    cp -f "$BACKUP_PATH/config.json" "$INSTALL_PATH/"
    CONF_PORT=$(grep -oE '"port": *[0-9]+' config.json | awk -F: '{print $2}' | tr -d ' ,')
    PORT=${CONF_PORT:-$NEXT_PORT}
    
    if [[ -f "$BACKUP_PATH/ecosystem.config.js" ]]; then
        echo -e "${GREEN}检测到原版 ecosystem 配置，正在应用并自动修正路径...${NC}"
        cp -f "$BACKUP_PATH/ecosystem.config.js" "$INSTALL_PATH/"
        sed -i "s|cwd:.*|cwd: '$INSTALL_PATH',|g" "$INSTALL_PATH/ecosystem.config.js"
        sed -i "s|name:.*|name: '$BOX_NAME',|g" "$INSTALL_PATH/ecosystem.config.js"
    else
        cat > ecosystem.config.js <<EOF
module.exports = {
  apps : [{
    name: "$BOX_NAME",
    script: "node_modules/.bin/tsx",
    args: "src/index.ts",
    cwd: "$INSTALL_PATH",
    env: { NODE_ENV: "production", PORT: $PORT },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF
    fi
fi

# --- 安装依赖 ---
echo -e "\n${YELLOW}>>> 安装项目依赖 <<<${NC}"
rm -rf package-lock.json node_modules
npm install --silent
pip3 install rlottie-python Pillow --break-system-packages --quiet

# --- 交互式登录保护逻辑 ---
if [[ "$MODE" == "1" ]]; then
    echo -e "\n${BLUE}=================================================${NC}"
    echo -e "${YELLOW}   ⚠️  Userbot 登录环节 (请仔细阅读)   ${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo -e "1. 依次输入：${GREEN}手机号${NC} -> ${GREEN}验证码${NC} -> ${GREEN}二步密码${NC}。"
    echo -e "2. 当看到 ${GREEN}'Successfully logged in'${NC} 后..."
    echo -e "   👉 请按下 ${RED}Ctrl + C${NC} 停止前台运行。"
    echo -e "3. 脚本将自动接管并转入 PM2 后台守护模式！"
    echo -e "${BLUE}=================================================${NC}"
    read -p "准备好了吗？按回车开始..."

    trap 'echo -e "\n${GREEN}>>> 捕捉到退出信号。正在无缝转入后台守护模式...${NC}"' SIGINT
    npm run start
    trap - SIGINT
fi

# --- 启动后台与固化 ---
echo -e "\n${YELLOW}>>> 启动 PM2 后台进程 <<<${NC}"
pm2 start ecosystem.config.js
pm2 save
STARTUP_CMD=$(pm2 startup systemd -u $CURRENT_USER --hp $HOME | grep "sudo env")
[[ -n "$STARTUP_CMD" ]] && eval "$STARTUP_CMD"
pm2 save

echo -e "\n${GREEN}✅ 部署彻底完成！${NC}"
echo -e "当前实例: [ $BOX_NAME ] | 运行端口: [ $PORT ]"
pm2 list | grep "$BOX_NAME"
