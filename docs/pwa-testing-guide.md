# PWA Testing Guide - Recipe Tracker

## Overview
This guide covers how to test the Progressive Web App (PWA) features that have been implemented in the Recipe Tracker application.

## 🚀 Quick Test (Development Environment)

### Prerequisites
1. **Browser**: Use Chrome, Edge, or Safari for best PWA support
2. **Development Server**: Run `npm run dev`
3. **HTTPS**: For full PWA features, serve over HTTPS (production deployment)

### Basic PWA Features Test

#### 1. Service Worker Registration
1. Open browser DevTools (F12)
2. Go to **Application** tab > **Service Workers**
3. Should see service worker registered for localhost
4. Status should show "activated and running"

#### 2. Web App Manifest
1. In DevTools **Application** tab > **Manifest**
2. Should display Recipe Tracker manifest details:
   - Name: "Recipe Tracker"
   - Short name: "Recipes"
   - Icons: Various sizes from 72x72 to 512x512
   - Display: "standalone"
   - Shortcuts: Add Meal, View History

#### 3. PWA Status Display
1. Navigate to **Data Management** page (`/account`)
2. Should see **PWA Status** section showing:
   - ✅ Installed as App (if installed)
   - ✅ Offline Support
   - ✅ Native File Picker (Chrome/Edge)
   - Status indicators for each feature

## 🎯 Core Feature Testing

### Native File Picker (Primary Goal)

#### Testing Export with Native File Picker:
1. **Chrome/Edge (Supported)**:
   - Go to Data Management > Export Data
   - Click "Export All Data (JSON)"
   - Should see native "Save As" dialog
   - Can choose Google Drive, OneDrive, local folders
   - Success message includes save location

2. **Other Browsers (Fallback)**:
   - Same steps as above
   - Falls back to traditional download
   - File saves to default downloads folder

#### Expected Results:
- **Chrome/Edge**: "Saved to your chosen location (Google Drive, OneDrive, local folder, etc.)"
- **Other browsers**: "Downloaded to your default downloads folder"

### App Installation

#### Desktop Installation (Chrome/Edge):
1. Visit the app in browser
2. Look for install prompt in **Data Management** page
3. Or browser address bar install icon ⬇️
4. Click "Install App"
5. App should install and open in standalone window

#### Mobile Installation:
1. **Android Chrome**:
   - Visit app, look for "Add to Home Screen" prompt
   - Or browser menu > "Install app"

2. **iOS Safari**:
   - Share button > "Add to Home Screen"
   - Creates app icon on home screen

#### Verification:
- App opens without browser UI (no address bar, tabs)
- Has proper app icon and name
- PWA Status shows "✅ Running as installed app!"

### Offline Functionality

#### Test Offline Support:
1. **Network Tab**: DevTools > Network > "Offline" checkbox
2. **Refresh page**: Should still load (cached by service worker)
3. **Navigation**: All pages should work offline
4. **Data operations**: Can add meals, view history offline
5. **Sync**: Changes sync when back online

#### Expected Behavior:
- App loads completely when offline
- Shows cached meal data
- New meals saved locally, sync when online
- No broken functionality

## 🔧 Advanced Testing

### Service Worker Caching

#### Cache Verification:
1. **DevTools** > **Application** > **Storage** > **Cache Storage**
2. Should see caches:
   - `recipe-tracker-static-v1`: App shell files
   - `recipe-tracker-dynamic-v1`: API responses

#### Cache Strategy Testing:
1. **Static resources**: Should load from cache instantly
2. **Dynamic content**: Network-first, cache fallback
3. **API calls**: Cached when offline, fresh when online

### File System Access API

#### Feature Detection:
```javascript
// In browser console:
console.log('File System Access API:', 'showSaveFilePicker' in window);
```

#### Browser Support Matrix:
- **Chrome 86+**: ✅ Full support
- **Edge 86+**: ✅ Full support
- **Firefox**: ❌ Not supported (fallback used)
- **Safari**: ❌ Not supported (fallback used)

### Install Prompt Testing

#### Trigger Install Prompt:
1. **Clear install state**: DevTools > Application > Storage > Clear storage
2. **Reload page**: Should trigger `beforeinstallprompt` event
3. **Install prompt**: Should appear in Data Management page
4. **Test dismissal**: "Later" button should hide prompt
5. **Test installation**: "Install App" should show native prompt

## 📱 Cross-Platform Testing

### Desktop Browsers

#### Chrome/Chromium:
- ✅ Install prompt
- ✅ Native file picker
- ✅ Service worker
- ✅ Offline functionality

#### Edge:
- ✅ Install prompt
- ✅ Native file picker
- ✅ Service worker
- ✅ Offline functionality

#### Firefox:
- ⚠️ Limited install support
- ❌ No native file picker (fallback works)
- ✅ Service worker
- ✅ Offline functionality

#### Safari:
- ⚠️ Different install method
- ❌ No native file picker (fallback works)
- ✅ Service worker
- ✅ Offline functionality

### Mobile Devices

#### Android Chrome:
- ✅ Full PWA support
- ✅ Install prompt
- ✅ Native file picker
- ✅ Home screen installation

#### iOS Safari:
- ⚠️ Manual installation (Add to Home Screen)
- ❌ No native file picker (fallback works)
- ✅ Offline functionality
- ✅ Home screen installation

## 🐛 Troubleshooting

### Common Issues

#### Service Worker Not Registering:
- **Check**: Browser DevTools console for errors
- **Solution**: Ensure `sw.js` is accessible at `/sw.js`
- **Note**: Service workers require HTTPS in production

#### Install Prompt Not Showing:
- **Check**: PWA criteria met (manifest, service worker, HTTPS)
- **Try**: Clear browser data and reload
- **Note**: Prompt only shows once per origin per user

#### Native File Picker Not Working:
- **Check**: Browser support (Chrome/Edge 86+)
- **Verify**: Feature detection in PWA Status
- **Fallback**: Traditional download should still work

#### Offline Mode Issues:
- **Check**: Service worker status in DevTools
- **Verify**: Network requests are being cached
- **Clear**: Cache storage and re-test

### Debugging Tools

#### Chrome DevTools:
- **Application > Service Workers**: Registration status
- **Application > Manifest**: PWA manifest validation
- **Network**: Cache hits vs network requests
- **Console**: PWA-related log messages

#### Lighthouse Audit:
1. **DevTools** > **Lighthouse** > **Progressive Web App**
2. **Run audit** to get PWA score
3. **Target**: 90+ score for production readiness

## ✅ Production Testing Checklist

### Before Deployment:
- [ ] Service worker registers successfully
- [ ] Manifest validates without errors
- [ ] All PWA icons load correctly
- [ ] Install prompt appears appropriately
- [ ] Native file picker works (Chrome/Edge)
- [ ] Offline functionality works completely
- [ ] App installs and runs standalone
- [ ] Lighthouse PWA score > 90

### Post-Deployment:
- [ ] Test on multiple devices/browsers
- [ ] Verify HTTPS-only features work
- [ ] Check cross-device sync functionality
- [ ] Monitor install conversion rates
- [ ] Collect user feedback on PWA experience

## 📊 Success Metrics

### Technical Metrics:
- **Lighthouse PWA Score**: 90+
- **Service Worker Cache Hit Rate**: >80%
- **File Save Success Rate**: >95%
- **Install Conversion Rate**: >10%

### User Experience:
- **Export saves to chosen location**: Google Drive, OneDrive, etc.
- **App feels native when installed**: No browser UI
- **Fast loading**: <2s on 3G
- **Works fully offline**: All functionality available

## 🔄 Next Steps

After successful testing:

1. **Merge to main**: Create pull request from feature branch
2. **Deploy to production**: Test on live HTTPS environment
3. **Monitor metrics**: Track PWA adoption and usage
4. **Iterate**: Gather user feedback and improve
5. **Advanced features**: Push notifications, background sync

---

**Testing URL**: http://localhost:3001 (or your dev server)
**Production PWA Requirements**: HTTPS, valid manifest, service worker
**Key Success**: Native file picker saves to Google Drive/OneDrive