import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Apanel',
  description: '移动端优先、面向 Linux 运维人员的轻量服务器管理面板',
  lang: 'zh-CN',

  themeConfig: {
    nav: [{ text: '首页', link: '/' }],

    sidebar: [
      {
        text: '指南',
        items: [{ text: '简介', link: '/readme' }],
      },
      {
        text: '安装与安全',
        items: [
          { text: '安装', link: '/install' },
          { text: '编译', link: '/build' },
          { text: '升级', link: '/upgrade' },
          { text: '卸载', link: '/uninstall' },
          { text: '安全使用', link: '/secure' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/axogc/apanel' }],
  },
})
