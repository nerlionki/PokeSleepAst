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
        "text": "宝可梦"
      },
      {
        "pagePath": "pages/plan/index",
        "text": "规划"
      },
      {
        "pagePath": "pages/team/index",
        "text": "配队"
      },
      {
        "pagePath": "pages/data/index",
        "text": "资料"
      },
      {
        "pagePath": "pages/profile/index",
        "text": "我的"
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
      "name": "asset-pack4",
      "root": "asset-pack4",
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
