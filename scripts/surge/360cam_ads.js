// 360 camera presentation cleanup. Leaves device/event/video APIs untouched.
(function () {
  const body = $response.body;
  if (typeof body !== 'string') return $done({});
  try {
    const url = $request.url;
    let updated = body;

    if (/^https:\/\/q5\.jia\.360\.cn\/event\/getStatistics(?:\?|$)/.test(url)) {
      updated = JSON.stringify({ errorCode: 0, data: [], errorMsg: '成功' });
    } else if (/\/conf\/v1\.json(?:\?|$)/.test(url)) {
      const data = JSON.parse(body);
      for (const key of ['topBannerServiceConfig', 'tab_conf', 'ad_conf', 'activity']) {
        if (Array.isArray(data[key])) data[key] = [];
        else if (data[key] && typeof data[key] === 'object') {
          if ('on' in data[key]) data[key].on = typeof data[key].on === 'string' ? '0' : 0;
          if ('data' in data[key] && Array.isArray(data[key].data)) data[key].data = [];
          for (const field of ['imageUrl', 'jumpUrl', 'jump_url']) {
            if (field in data[key]) data[key][field] = '';
          }
        }
        if (key in data && (Array.isArray(data[key]) || typeof data[key] !== 'object')) data[key] = [];
      }
      for (const key of [
        'get_new_device_activity', 'get_new_device_activity_copy',
        'video_cloud_banner', 'video_cloud_card', 'cardCloudConfig'
      ]) {
        if (!data[key] || typeof data[key] !== 'object') continue;
        if ('on' in data[key]) data[key].on = typeof data[key].on === 'string' ? '0' : 0;
        for (const field of ['imageUrl', 'jumpUrl', 'jump_url']) {
          if (field in data[key]) data[key][field] = '';
        }
      }
      updated = JSON.stringify(data);
    } else if (/\/data\/yunlu\/promotion_app\.json(?:\?|$)/.test(url)) {
      const data = JSON.parse(body);
      const d = data.data || {};
      for (const key of ['doorbell_activity_open', 'camera_activity_open', 'cloud_pay']) {
        if (key in d) d[key] = '0';
      }
      for (const key of [
        'doorbell_activity_tip', 'camera_activity_tip',
        'cloud_new_user_tip', 'cloud_repeat_purchase_tip',
        'doorbell_activity_url', 'camera_activity_url'
      ]) {
        if (key in d) d[key] = '';
      }
      updated = JSON.stringify(data);
    } else if (/\/data\/yunlu\/specialpromotion\.json(?:\?|$)/.test(url)) {
      updated = body.replace(/("isTimer"\s*:\s*)1\b/g, '$10');
    } else {
      updated = body
        .replace(/("adPopStart"\s*:\s*)true\b/g, '$1false')
        .replace(/("showFlash"\s*:\s*)true\b/g, '$1false')
        .replace(/("is_open_(?:promotion|head_promotion|home_promotion)"\s*:\s*)"1"/g, '$1"0"');
    }
    $done(updated === body ? {} : { body: updated });
  } catch (_) {
    $done({});
  }
})();
