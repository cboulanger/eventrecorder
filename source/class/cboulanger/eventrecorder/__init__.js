/** <h3> Event recorder API Documentation </h3>
 *
 * See documentation in the readme.
 *
 * This library uses the following environment variables:
 *
 * <table>
 *   <tr>
 *     <td>"module.objectId": {Boolean}</td>
 *     <td>Must be true, otherwise the recorder cannot function</td>
 *   </tr>
 *   <tr>
 *     <td>"eventrecorder.enabled": {Boolean}</td>
 *     <td>Simple switch to dis-/enable the recorder</td>
 *   </tr>
 *   <tr>
 *     <td>"eventrecorder.mode": {String}</td>
 *     <td>Either "test" or "presentation" (See {@link cboulanger.eventrecorder.player.Abstract#mode}. Defaults to "presentation"</td></tr>
 *   <tr>
 *     <td>"eventrecorder.showProgress": {Boolean}</td>
 *     <td>If true, show a progress indicator</td>
 *   </tr>
 *   <tr>
 *     <td>"eventrecorder.makeScriptable": {Boolean}</td>
 *     <td>Whether the UI events of the recorder itself should be recorded</td>
 *   </tr>
 * </table>
 *
 */
