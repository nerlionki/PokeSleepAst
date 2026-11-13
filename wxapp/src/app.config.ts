export default defineAppConfig({
  "pages": [
    "pages/pokemon/index",
    "pages/plan/index",
    "pages/team/index",
    "pages/data/index",
    "pages/profile/index"
  ],
  "window": {
    "navigationBarTitleText": "宝睡助手",
    "navigationBarBackgroundColor": "#081018",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#081018"
  },
  "tabBar": {
    "color": "#93a4b5",
    "selectedColor": "#7fcec0",
    "backgroundColor": "#101a26",
    "list": [
      {
        "pagePath": "pages/pokemon/index",
        "text": "宝可梦",
        "iconPath": "assets/tabbar/pokemon-normal.png",
        "selectedIconPath": "assets/tabbar/pokemon-selected.png"
      },
      {
        "pagePath": "pages/plan/index",
        "text": "规划",
        "iconPath": "assets/tabbar/plan-normal.png",
        "selectedIconPath": "assets/tabbar/plan-selected.png"
      },
      {
        "pagePath": "pages/team/index",
        "text": "配队",
        "iconPath": "assets/tabbar/team-normal.png",
        "selectedIconPath": "assets/tabbar/team-selected.png"
      },
      {
        "pagePath": "pages/data/index",
        "text": "资料",
        "iconPath": "assets/tabbar/data-normal.png",
        "selectedIconPath": "assets/tabbar/data-selected.png"
      },
      {
        "pagePath": "pages/profile/index",
        "text": "我的",
        "iconPath": "assets/tabbar/profile-normal.png",
        "selectedIconPath": "assets/tabbar/profile-selected.png"
      }
    ]
  },
  "subPackages": [
    {
      "name": "asset-pack0",
      "root": "asset-pack0",
      "pages": [
        "index"
      ]
    },
    {
      "name": "asset-pack1",
      "root": "asset-pack1",
      "pages": [
        "index"
      ]
    },
    {
      "name": "asset-pack2",
      "root": "asset-pack2",
      "pages": [
        "index"
      ]
    },
    {
      "name": "asset-pack3",
      "root": "asset-pack3",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack0",
      "root": "ocr-pack0",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack1",
      "root": "ocr-pack1",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack2",
      "root": "ocr-pack2",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack3",
      "root": "ocr-pack3",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack4",
      "root": "ocr-pack4",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack5",
      "root": "ocr-pack5",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack6",
      "root": "ocr-pack6",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack7",
      "root": "ocr-pack7",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack8",
      "root": "ocr-pack8",
      "pages": [
        "index"
      ]
    },
    {
      "name": "ocr-pack9",
      "root": "ocr-pack9",
      "pages": [
        "index"
      ]
    },
    {
      "name": "i18n-pack",
      "root": "i18n-pack",
      "pages": [
        "index"
      ]
    }
  ],
  "workers": {
    "path": "workers",
    "isSubpackage": true
  },
  "lazyCodeLoading": "requiredComponents"
})
